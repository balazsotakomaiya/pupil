/// Keeps the executable entry point tiny and forwards setup work into `lib.rs`,
/// where the actual backend wiring lives.
fn main() {
    pupil_app_lib::run();
}
