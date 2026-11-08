//! A tiny loopback HTTP server for exercising provider clients end to end
//! without the network. Each connection is one request/response.

use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::Duration;

#[derive(Clone, Debug)]
pub(crate) struct MockRequest {
    pub(crate) method: String,
    pub(crate) path: String,
    pub(crate) headers: HashMap<String, String>,
    pub(crate) body: String,
}

impl MockRequest {
    pub(crate) fn form(&self) -> HashMap<String, String> {
        url_pairs(&self.body)
    }

    pub(crate) fn path_only(&self) -> &str {
        self.path.split('?').next().unwrap_or_default()
    }
}

pub(crate) fn url_pairs(encoded: &str) -> HashMap<String, String> {
    reqwest::Url::parse(&format!("http://x/?{encoded}"))
        .map(|url| url.query_pairs().into_owned().collect())
        .unwrap_or_default()
}

pub(crate) struct MockResponse {
    pub(crate) status: u16,
    pub(crate) content_type: &'static str,
    pub(crate) body: String,
}

impl MockResponse {
    pub(crate) fn json(status: u16, body: serde_json::Value) -> Self {
        Self {
            status,
            content_type: "application/json",
            body: body.to_string(),
        }
    }

    pub(crate) fn sse(events: &[serde_json::Value]) -> Self {
        let body = events
            .iter()
            .map(|event| {
                format!(
                    "event: {}\ndata: {}\n\n",
                    event["type"].as_str().unwrap_or("message"),
                    event
                )
            })
            .collect::<String>();
        Self {
            status: 200,
            content_type: "text/event-stream",
            body,
        }
    }
}

type Handler = dyn Fn(&MockRequest) -> MockResponse + Send + Sync;

pub(crate) struct MockServer {
    pub(crate) base: String,
    pub(crate) requests: Arc<Mutex<Vec<MockRequest>>>,
    stop: Arc<AtomicBool>,
    thread: Option<JoinHandle<()>>,
}

impl MockServer {
    pub(crate) fn start(
        handler: impl Fn(&MockRequest) -> MockResponse + Send + Sync + 'static,
    ) -> Self {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind mock server");
        listener.set_nonblocking(true).expect("nonblocking");
        let base = format!("http://127.0.0.1:{}", listener.local_addr().unwrap().port());
        let requests = Arc::new(Mutex::new(Vec::new()));
        let stop = Arc::new(AtomicBool::new(false));
        let handler: Arc<Handler> = Arc::new(handler);
        let thread_requests = Arc::clone(&requests);
        let thread_stop = Arc::clone(&stop);
        let thread = std::thread::spawn(move || {
            while !thread_stop.load(Ordering::SeqCst) {
                match listener.accept() {
                    Ok((mut stream, _)) => {
                        stream.set_nonblocking(false).ok();
                        stream.set_read_timeout(Some(Duration::from_secs(5))).ok();
                        let Some(request) = read_request(&mut stream) else {
                            continue;
                        };
                        thread_requests.lock().unwrap().push(request.clone());
                        let response = handler(&request);
                        let reason = if response.status < 400 { "OK" } else { "Error" };
                        let _ = write!(
                            stream,
                            "HTTP/1.1 {} {reason}\r\nContent-Type: {}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                            response.status,
                            response.content_type,
                            response.body.len(),
                            response.body
                        );
                        let _ = stream.flush();
                    }
                    Err(_) => std::thread::sleep(Duration::from_millis(5)),
                }
            }
        });
        Self {
            base,
            requests,
            stop,
            thread: Some(thread),
        }
    }

    pub(crate) fn requests_to(&self, path: &str) -> Vec<MockRequest> {
        self.requests
            .lock()
            .unwrap()
            .iter()
            .filter(|request| request.path_only() == path)
            .cloned()
            .collect()
    }
}

impl Drop for MockServer {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::SeqCst);
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}

fn read_request(stream: &mut std::net::TcpStream) -> Option<MockRequest> {
    let mut buffer = Vec::new();
    let mut chunk = [0u8; 4096];
    let header_end = loop {
        let read = stream.read(&mut chunk).ok()?;
        if read == 0 {
            return None;
        }
        buffer.extend_from_slice(&chunk[..read]);
        if let Some(index) = buffer.windows(4).position(|window| window == b"\r\n\r\n") {
            break index + 4;
        }
    };
    let head = String::from_utf8_lossy(&buffer[..header_end]).into_owned();
    let mut lines = head.lines();
    let mut request_line = lines.next()?.split_whitespace();
    let method = request_line.next()?.to_string();
    let path = request_line.next()?.to_string();
    let headers: HashMap<String, String> = lines
        .filter_map(|line| line.split_once(':'))
        .map(|(name, value)| (name.trim().to_ascii_lowercase(), value.trim().to_string()))
        .collect();
    let length = headers
        .get("content-length")
        .and_then(|value| value.parse::<usize>().ok())
        .unwrap_or(0);
    while buffer.len() < header_end + length {
        let read = stream.read(&mut chunk).ok()?;
        if read == 0 {
            break;
        }
        buffer.extend_from_slice(&chunk[..read]);
    }
    let body = String::from_utf8_lossy(&buffer[header_end..]).into_owned();
    Some(MockRequest {
        method,
        path,
        headers,
        body,
    })
}
