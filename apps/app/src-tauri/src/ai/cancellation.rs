use std::collections::HashMap;
use std::future::Future;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use tokio::sync::watch;

use crate::error::{AiConnectionReason, AppError, AppResult};

/// Tracks in-flight AI requests by a frontend-chosen ID so the user can cancel
/// one. Cancelling drops the request future: an HTTP call is aborted and a
/// Claude Code child process is killed (it is spawned with `kill_on_drop`).
#[derive(Default)]
pub(crate) struct AiRequestRegistry {
    requests: Mutex<HashMap<String, (u64, watch::Sender<bool>)>>,
    generation: AtomicU64,
}

/// Held for the lifetime of one request; removes its registry entry on drop.
pub(crate) struct AiRequestGuard {
    registry: Arc<AiRequestRegistry>,
    id: Option<(String, u64)>,
    pub(crate) token: CancelToken,
}

impl Drop for AiRequestGuard {
    fn drop(&mut self) {
        if let Some((id, generation)) = self.id.take() {
            if let Ok(mut requests) = self.registry.requests.lock() {
                // Only remove our own entry; a newer request may reuse the ID.
                if requests.get(&id).map(|(current, _)| *current) == Some(generation) {
                    requests.remove(&id);
                }
            }
        }
    }
}

/// A cheap, cloneable view of one request's cancellation state.
#[derive(Clone)]
pub(crate) struct CancelToken {
    receiver: Option<watch::Receiver<bool>>,
}

impl CancelToken {
    /// A token that never fires, for internal calls with nothing to cancel.
    pub(crate) fn none() -> Self {
        Self { receiver: None }
    }

    pub(crate) fn is_cancelled(&self) -> bool {
        self.receiver
            .as_ref()
            .map(|receiver| *receiver.borrow())
            .unwrap_or(false)
    }

    /// Resolves once the request is cancelled; never resolves for `none()`.
    pub(crate) async fn cancelled(&self) {
        let Some(mut receiver) = self.receiver.clone() else {
            std::future::pending::<()>().await;
            return;
        };
        loop {
            if *receiver.borrow() {
                return;
            }
            if receiver.changed().await.is_err() {
                // Sender dropped without cancelling: the request finished.
                std::future::pending::<()>().await;
            }
        }
    }
}

impl AiRequestRegistry {
    /// Registers a request. Without an ID the request simply cannot be
    /// cancelled, which keeps older callers working.
    pub(crate) fn register(self: &Arc<Self>, id: Option<String>) -> AiRequestGuard {
        let Some(id) = id.filter(|id| is_valid_request_id(id)) else {
            return AiRequestGuard {
                registry: Arc::clone(self),
                id: None,
                token: CancelToken::none(),
            };
        };
        let (sender, receiver) = watch::channel(false);
        let generation = self.generation.fetch_add(1, Ordering::SeqCst);
        if let Ok(mut requests) = self.requests.lock() {
            // A reused ID cancels whatever was still running under it.
            if let Some((_, previous)) = requests.insert(id.clone(), (generation, sender)) {
                let _ = previous.send(true);
            }
        }
        AiRequestGuard {
            registry: Arc::clone(self),
            id: Some((id, generation)),
            token: CancelToken {
                receiver: Some(receiver),
            },
        }
    }

    /// Cancels a request. Returns whether a running request had that ID.
    pub(crate) fn cancel(&self, id: &str) -> bool {
        let Ok(requests) = self.requests.lock() else {
            return false;
        };
        match requests.get(id) {
            Some((_, sender)) => sender.send(true).is_ok(),
            None => false,
        }
    }

    #[cfg(test)]
    pub(crate) fn active_count(&self) -> usize {
        self.requests.lock().map(|r| r.len()).unwrap_or(0)
    }
}

fn is_valid_request_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && id
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == '-' || ch == '_')
}

pub(crate) fn cancelled_error(provider: &str) -> AppError {
    AppError::ai_connection(
        provider,
        AiConnectionReason::Cancelled,
        "The AI request was cancelled.",
    )
}

/// Runs `future` until it finishes, the token fires, or `timeout` elapses.
/// Losing the race drops the future, which is what aborts the work.
pub(crate) async fn run_bounded<T>(
    provider: &str,
    token: &CancelToken,
    timeout: Duration,
    timeout_message: String,
    future: impl Future<Output = AppResult<T>>,
) -> AppResult<T> {
    if token.is_cancelled() {
        return Err(cancelled_error(provider));
    }
    tokio::select! {
        result = tokio::time::timeout(timeout, future) => match result {
            Ok(result) => result,
            Err(_) => Err(AppError::ai_connection(
                provider,
                AiConnectionReason::Timeout,
                timeout_message,
            )),
        },
        () = token.cancelled() => Err(cancelled_error(provider)),
    }
}
