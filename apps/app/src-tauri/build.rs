/// Runs Tauri's build-time code generation so the desktop shell has the metadata
/// and bindings it needs at compile time.
fn main() {
    tauri_build::build()
}
