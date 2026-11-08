//! The ChatGPT connection's lifecycle: sign in, keep the access token fresh,
//! run requests, and disconnect. Secret storage is behind [`CredentialStore`]
//! so the whole flow runs against a mock OpenAI in tests.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use rusqlite::Connection;
use tokio::sync::Mutex as AsyncMutex;

use super::chatgpt::{
    bind_loopback, build_authorize_url, exchange_code, execute_responses, fetch_discovery,
    fetch_jwks, is_registration_rejected, is_valid_host_id, list_models, new_host_id,
    parse_callback, refresh_tokens, revoke, split_scopes, validate_id_claims, verify_rs256,
    wait_for_callback, ChatgptCredentials, ChatgptEndpoints, ChatgptModel, PendingAuthorization,
    TokenResponse, CHATGPT_PROVIDER,
};
use super::settings_store::{delete_setting, load_string_setting, upsert_setting_on};
use crate::constants::{
    AI_SETTING_CHATGPT_CLIENT_ID_KEY, AI_SETTING_CHATGPT_EMAIL_KEY, AI_SETTING_CHATGPT_HOST_ID_KEY,
    AI_SETTING_CHATGPT_PLAN_USAGE_KEY, AI_SETTING_CHATGPT_STATUS_KEY,
};
use crate::error::{AiConnectionReason, AppError, AppResult};

/// Where Pupil keeps the credential record it owns.
pub(crate) trait CredentialStore: Sync {
    fn load(&self) -> AppResult<Option<ChatgptCredentials>>;
    fn save(&self, credentials: &ChatgptCredentials) -> AppResult<()>;
    fn clear(&self) -> AppResult<()>;
    /// The gate that orders changes to this store's session.
    fn gate(&self) -> &SessionGate;
}

/// Orders everything that changes the stored session. Refreshes are
/// serialized, because refresh tokens rotate. Each sign-in or disconnect
/// starts a new generation, and a refresh or request that began in an
/// earlier generation can't save tokens or start inference after it.
#[derive(Default)]
pub(crate) struct SessionGate {
    refresh: AsyncMutex<()>,
    generation: Mutex<u64>,
}

impl SessionGate {
    fn lock_generation(&self) -> std::sync::MutexGuard<'_, u64> {
        self.generation
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
    }

    pub(crate) fn generation(&self) -> u64 {
        *self.lock_generation()
    }

    /// Runs `change` only if the session is still the one seen at
    /// `generation`. Returns whether it ran.
    fn commit_if_current(
        &self,
        generation: u64,
        change: impl FnOnce() -> AppResult<()>,
    ) -> AppResult<bool> {
        let current = self.lock_generation();
        if *current != generation {
            return Ok(false);
        }
        change()?;
        Ok(true)
    }

    /// Starts a new session generation and makes `change` under it.
    fn replace<T>(&self, change: impl FnOnce() -> AppResult<T>) -> AppResult<T> {
        let mut current = self.lock_generation();
        *current += 1;
        change()
    }
}

/// The gate for the session in the OS secure store.
pub(crate) fn secure_store_gate() -> &'static SessionGate {
    static GATE: OnceLock<SessionGate> = OnceLock::new();
    GATE.get_or_init(SessionGate::default)
}

/// Connection status kept in SQLite. It is display state only; the tokens
/// themselves are never written there.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum ChatgptStatus {
    Disconnected,
    Connected,
    Expired,
}

impl ChatgptStatus {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::Disconnected => "disconnected",
            Self::Connected => "connected",
            Self::Expired => "expired",
        }
    }

    pub(crate) fn parse(value: &str) -> Self {
        match value {
            "connected" => Self::Connected,
            "expired" => Self::Expired,
            _ => Self::Disconnected,
        }
    }
}

/// One sign-in at a time; a second attempt is refused while the first waits
/// for the browser, and Cancel stops the waiting listener.
#[derive(Default)]
pub(crate) struct SignInControl {
    in_progress: AtomicBool,
    cancel: AtomicBool,
}

pub(crate) struct SignInTicket<'a>(&'a SignInControl);

impl Drop for SignInTicket<'_> {
    fn drop(&mut self) {
        self.0.in_progress.store(false, Ordering::SeqCst);
    }
}

impl SignInControl {
    pub(crate) fn begin(&self) -> AppResult<SignInTicket<'_>> {
        if self
            .in_progress
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_err()
        {
            return Err(AppError::validation(
                "A ChatGPT sign-in is already open. Finish it in your browser, or cancel it.",
            ));
        }
        self.cancel.store(false, Ordering::SeqCst);
        Ok(SignInTicket(self))
    }

    pub(crate) fn cancel(&self) -> bool {
        let running = self.in_progress.load(Ordering::SeqCst);
        if running {
            self.cancel.store(true, Ordering::SeqCst);
        }
        running
    }
}

pub(crate) fn sign_in_control() -> &'static SignInControl {
    static CONTROL: OnceLock<SignInControl> = OnceLock::new();
    CONTROL.get_or_init(SignInControl::default)
}

/// The non-secret values a sign-in needs from SQLite.
pub(crate) struct SignInInputs {
    pub(crate) host_id: String,
    pub(crate) saved_client_id: Option<String>,
}

/// `new_account` starts a fresh registration, which is how a different
/// ChatGPT account or workspace signs in; otherwise the saved registration
/// is reused, as OpenAI asks for a returning account.
pub(crate) fn load_sign_in_inputs(
    connection: &Connection,
    new_account: bool,
) -> AppResult<SignInInputs> {
    let mut host_id = load_string_setting(connection, AI_SETTING_CHATGPT_HOST_ID_KEY, "")?;
    if !is_valid_host_id(&host_id) {
        // Chosen and persisted once, before the first sign-in, as OpenAI asks.
        host_id = new_host_id()?;
        upsert_setting_on(connection, AI_SETTING_CHATGPT_HOST_ID_KEY, &host_id)?;
    }
    let saved_client_id = Some(load_string_setting(
        connection,
        AI_SETTING_CHATGPT_CLIENT_ID_KEY,
        "",
    )?)
    .filter(|id| !id.trim().is_empty() && !new_account);
    Ok(SignInInputs {
        host_id,
        saved_client_id,
    })
}

pub(crate) fn credentials_from_tokens(
    tokens: TokenResponse,
    client_id: String,
    subject: String,
    email: Option<String>,
    previous: Option<&ChatgptCredentials>,
    now_ms: i64,
) -> ChatgptCredentials {
    let scopes = match tokens.scope.as_deref() {
        Some(scope) => split_scopes(Some(scope)),
        None => previous.map(|p| p.scopes.clone()).unwrap_or_default(),
    };
    ChatgptCredentials {
        client_id,
        subject,
        email,
        id_token: tokens
            .id_token
            .or_else(|| previous.map(|p| p.id_token.clone()))
            .unwrap_or_default(),
        access_token: tokens.access_token,
        // Refresh tokens rotate; keep the old one only if none came back.
        refresh_token: tokens
            .refresh_token
            .or_else(|| previous.and_then(|p| p.refresh_token.clone())),
        token_type: tokens.token_type.unwrap_or_else(|| "Bearer".to_string()),
        expires_at_ms: now_ms + tokens.expires_in.unwrap_or(3600).clamp(60, 86_400) * 1000,
        scopes,
        saved_at_ms: now_ms,
    }
}

/// Runs the browser sign-in to completion. `open_browser` receives the
/// authorization URL; the listener is bound before it is called.
pub(crate) async fn run_sign_in(
    endpoints: &ChatgptEndpoints,
    control: &'static SignInControl,
    inputs: SignInInputs,
    open_browser: impl FnOnce(&str) -> AppResult<()>,
    timeout: Duration,
    now_ms: impl Fn() -> i64,
) -> AppResult<ChatgptCredentials> {
    let _ticket = control.begin()?;
    let (listener, port) = bind_loopback()?;
    let pending = PendingAuthorization::new(inputs.saved_client_id, port)?;
    let url = build_authorize_url(endpoints, &pending, &inputs.host_id)?;
    open_browser(url.as_str())?;

    let deadline = Instant::now() + timeout;
    // The listener blocks, so it waits on the blocking pool rather than an
    // async worker; it gives up at the deadline or when Cancel is pressed.
    let target = tokio::task::spawn_blocking(move || {
        wait_for_callback(&listener, deadline, &control.cancel)
    })
    .await
    .map_err(|_| AppError::internal_message("The sign-in listener stopped."))??;

    let code = parse_callback(&target, &pending)?;
    let tokens = exchange_code(endpoints, &pending, &code).await?;
    let id_token = tokens.id_token.clone().ok_or_else(|| {
        AppError::ai_connection(
            CHATGPT_PROVIDER,
            AiConnectionReason::Provider,
            "OpenAI's sign-in reply had no identity token. Try connecting again.",
        )
    })?;
    let discovery = fetch_discovery(endpoints).await?;
    let jwks = fetch_jwks(&discovery).await?;
    let claims = verify_rs256(&id_token, &jwks)?;
    let identity = validate_id_claims(
        &claims,
        &discovery.issuer,
        &code.client_id,
        &pending.nonce,
        now_ms() / 1000,
    )?;
    Ok(credentials_from_tokens(
        tokens,
        code.client_id,
        identity.subject,
        identity.email,
        None,
        now_ms(),
    ))
}

/// Records a completed sign-in. The credentials go to the secure store first
/// so SQLite never claims a connection whose tokens failed to save.
pub(crate) fn record_sign_in(
    connection: &mut Connection,
    store: &dyn CredentialStore,
    credentials: &ChatgptCredentials,
) -> AppResult<()> {
    store.gate().replace(|| store.save(credentials))?;
    let transaction = connection.transaction()?;
    upsert_setting_on(
        &transaction,
        AI_SETTING_CHATGPT_CLIENT_ID_KEY,
        &credentials.client_id,
    )?;
    upsert_setting_on(
        &transaction,
        AI_SETTING_CHATGPT_STATUS_KEY,
        ChatgptStatus::Connected.as_str(),
    )?;
    upsert_setting_on(
        &transaction,
        AI_SETTING_CHATGPT_EMAIL_KEY,
        credentials.email.as_deref().unwrap_or_default(),
    )?;
    upsert_setting_on(
        &transaction,
        AI_SETTING_CHATGPT_PLAN_USAGE_KEY,
        if credentials.has_plan_usage() {
            "1"
        } else {
            "0"
        },
    )?;
    transaction.commit()?;
    Ok(())
}

pub(crate) fn record_status(connection: &Connection, status: ChatgptStatus) -> AppResult<()> {
    upsert_setting_on(connection, AI_SETTING_CHATGPT_STATUS_KEY, status.as_str())?;
    if status == ChatgptStatus::Disconnected {
        delete_setting(connection, AI_SETTING_CHATGPT_EMAIL_KEY)?;
        delete_setting(connection, AI_SETTING_CHATGPT_PLAN_USAGE_KEY)?;
    }
    Ok(())
}

/// Drops the saved registration, so the next sign-in registers afresh.
pub(crate) fn forget_registration(connection: &Connection) -> AppResult<()> {
    delete_setting(connection, AI_SETTING_CHATGPT_CLIENT_ID_KEY)?;
    Ok(())
}

/// Keeps SQLite honest after a request found the ChatGPT session over:
/// marks it expired so Settings offers Reconnect, and drops a registration
/// OpenAI rejected so reconnecting registers afresh.
pub(crate) fn note_session_failure(connection: &Connection, error: &AppError) -> AppResult<()> {
    if is_registration_rejected(error) {
        forget_registration(connection)?;
    }
    if matches!(
        error,
        AppError::AiConnection {
            reason: AiConnectionReason::Expired,
            provider,
            ..
        } if provider == CHATGPT_PROVIDER
    ) {
        record_status(connection, ChatgptStatus::Expired)?;
    }
    Ok(())
}

pub(crate) fn has_saved_registration(connection: &Connection) -> AppResult<bool> {
    Ok(
        !load_string_setting(connection, AI_SETTING_CHATGPT_CLIENT_ID_KEY, "")?
            .trim()
            .is_empty(),
    )
}

fn connection_ended() -> AppError {
    AppError::ai_connection(
        CHATGPT_PROVIDER,
        AiConnectionReason::Expired,
        "Your ChatGPT connection has ended. Reconnect in Settings to keep using your plan.",
    )
}

/// The user disconnected, or signed in again, while this request ran. It is
/// reported like a cancellation: nothing is recorded as expired.
fn session_changed() -> AppError {
    AppError::ai_connection(
        CHATGPT_PROVIDER,
        AiConnectionReason::Cancelled,
        "ChatGPT was disconnected or reconnected while this request was running.",
    )
}

/// Returns credentials with a live access token, refreshing when it is near
/// expiry (or when `force` is set after a 401). Refreshes are serialized
/// because refresh tokens rotate and a race would invalidate the session.
#[cfg(test)]
pub(crate) async fn ensure_fresh_credentials(
    endpoints: &ChatgptEndpoints,
    store: &dyn CredentialStore,
    force: bool,
    now_ms: &(dyn Fn() -> i64 + Sync),
) -> AppResult<ChatgptCredentials> {
    fresh_session(endpoints, store, force, now_ms)
        .await
        .map(|(credentials, _)| credentials)
}

/// Like [`ensure_fresh_credentials`], also returning the session generation
/// the credentials belong to.
async fn fresh_session(
    endpoints: &ChatgptEndpoints,
    store: &dyn CredentialStore,
    force: bool,
    now_ms: &(dyn Fn() -> i64 + Sync),
) -> AppResult<(ChatgptCredentials, u64)> {
    let gate = store.gate();
    let generation = gate.generation();
    let current = store.load()?.ok_or_else(connection_ended)?;
    if !force && !current.needs_refresh(now_ms()) {
        return Ok((current, generation));
    }
    let _guard = gate.refresh.lock().await;
    // Another request may have refreshed, or the user disconnected, while
    // this one waited.
    let generation = gate.generation();
    let current = store.load()?.ok_or_else(connection_ended)?;
    if !current.needs_refresh(now_ms()) && (!force || current.saved_at_ms > now_ms() - 5_000) {
        return Ok((current, generation));
    }
    match refresh_tokens(endpoints, &current).await {
        Ok(tokens) => {
            let next = credentials_from_tokens(
                tokens,
                current.client_id.clone(),
                current.subject.clone(),
                current.email.clone(),
                Some(&current),
                now_ms(),
            );
            if !gate.commit_if_current(generation, || store.save(&next))? {
                // Disconnected mid-refresh: don't keep, or leave usable,
                // the tokens that just arrived.
                let _ = revoke(endpoints, &next).await;
                return Err(session_changed());
            }
            Ok((next, generation))
        }
        Err(
            error @ AppError::AiConnection {
                reason: AiConnectionReason::Expired,
                ..
            },
        ) => {
            // The refresh token is unusable: clear it so nothing retries it,
            // unless a newer session has already replaced it.
            if !gate.commit_if_current(generation, || store.clear())? {
                return Err(session_changed());
            }
            Err(error)
        }
        Err(error) => Err(error),
    }
}

/// Fails if the session changed since `generation`, so a request never
/// starts on tokens from a session the user ended.
fn ensure_same_session(store: &dyn CredentialStore, generation: u64) -> AppResult<()> {
    if store.gate().generation() == generation {
        Ok(())
    } else {
        Err(session_changed())
    }
}

fn plan_usage_declined() -> AppError {
    AppError::ai_connection(
        CHATGPT_PROVIDER,
        AiConnectionReason::Declined,
        "ChatGPT plan usage wasn't allowed when you signed in. Reconnect and allow it, or use an API key.",
    )
}

/// Runs one request on the user's ChatGPT plan, refreshing once and
/// retrying if the token turns out to be stale.
pub(crate) async fn execute_chatgpt_completion(
    endpoints: &ChatgptEndpoints,
    store: &dyn CredentialStore,
    model: &str,
    system: Option<&str>,
    user: &str,
    now_ms: &(dyn Fn() -> i64 + Sync),
) -> AppResult<String> {
    let (credentials, generation) = fresh_session(endpoints, store, false, now_ms).await?;
    if !credentials.has_plan_usage() {
        return Err(plan_usage_declined());
    }
    ensure_same_session(store, generation)?;
    match execute_responses(endpoints, &credentials.access_token, model, system, user).await {
        Err(AppError::AiConnection {
            reason: AiConnectionReason::Expired,
            ..
        }) => {
            let (refreshed, generation) = fresh_session(endpoints, store, true, now_ms).await?;
            ensure_same_session(store, generation)?;
            execute_responses(endpoints, &refreshed.access_token, model, system, user).await
        }
        other => other,
    }
}

pub(crate) async fn list_chatgpt_models(
    endpoints: &ChatgptEndpoints,
    store: &dyn CredentialStore,
    now_ms: &(dyn Fn() -> i64 + Sync),
) -> AppResult<Vec<ChatgptModel>> {
    let (credentials, generation) = fresh_session(endpoints, store, false, now_ms).await?;
    ensure_same_session(store, generation)?;
    list_models(endpoints, &credentials.access_token).await
}

/// Forgets the session, then revokes it. Local tokens are cleared first,
/// under a new session generation, so a refresh already in flight can't
/// write them back and no new request can start on them. The return value
/// says whether OpenAI confirmed the revocation.
pub(crate) async fn disconnect(
    endpoints: &ChatgptEndpoints,
    store: &dyn CredentialStore,
) -> AppResult<bool> {
    let previous = store.gate().replace(|| {
        let previous = store.load()?;
        store.clear()?;
        Ok(previous)
    })?;
    Ok(match previous {
        Some(credentials) => revoke(endpoints, &credentials).await,
        None => true,
    })
}
