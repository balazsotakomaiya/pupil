use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use tauri::{AppHandle, Manager};
use tauri_plugin_stronghold::stronghold::Stronghold;

use crate::app::app_data_dir;
#[cfg(target_os = "macos")]
use crate::constants::{AI_SECRET_ACCOUNT_NAME, AI_SECRET_SERVICE_NAME};
#[cfg(not(target_os = "macos"))]
use crate::constants::{STRONGHOLD_AI_API_KEY_RECORD_KEY, STRONGHOLD_CLIENT_NAME};
use crate::constants::{
    STRONGHOLD_PASSWORD_ACCOUNT_NAME, STRONGHOLD_PASSWORD_BYTES, STRONGHOLD_PASSWORD_SERVICE_NAME,
    STRONGHOLD_SNAPSHOT_FILE_NAME,
};
use crate::error::{AppError, AppResult};

#[cfg_attr(target_os = "macos", allow(dead_code))]
#[derive(Default)]
pub(crate) struct StrongholdState {
    pub(crate) lock: Mutex<()>,
}

pub(crate) fn clear_ai_api_key(app: &AppHandle) -> AppResult<()> {
    #[cfg(target_os = "macos")]
    {
        let _ = app;
        clear_ai_api_key_macos()
    }

    #[cfg(not(target_os = "macos"))]
    with_stronghold_lock(app, || {
        let stronghold = open_stronghold(app)?;
        let client = stronghold
            .get_client(STRONGHOLD_CLIENT_NAME)
            .or_else(|_| stronghold.load_client(STRONGHOLD_CLIENT_NAME))
            .or_else(|_| stronghold.create_client(STRONGHOLD_CLIENT_NAME))
            .map_err(|error| AppError::storage_message(error.to_string()))?;
        let _ = client
            .store()
            .delete(STRONGHOLD_AI_API_KEY_RECORD_KEY)
            .map_err(|error| AppError::storage_message(error.to_string()))?;
        stronghold
            .save()
            .map_err(|error| AppError::storage_message(error.to_string()))?;

        Ok(())
    })
}

#[cfg_attr(target_os = "macos", allow(dead_code))]
fn stronghold_snapshot_path(app: &AppHandle) -> AppResult<PathBuf> {
    let path = app_data_dir(app)?.join(STRONGHOLD_SNAPSHOT_FILE_NAME);

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    Ok(path)
}

#[cfg_attr(target_os = "macos", allow(dead_code))]
fn stronghold_keyring_entry() -> AppResult<keyring::Entry> {
    keyring::Entry::new(
        STRONGHOLD_PASSWORD_SERVICE_NAME,
        STRONGHOLD_PASSWORD_ACCOUNT_NAME,
    )
    .map_err(|error| AppError::storage_message(error.to_string()))
}

#[cfg_attr(target_os = "macos", allow(dead_code))]
fn random_stronghold_password() -> AppResult<Vec<u8>> {
    let mut password = vec![0u8; STRONGHOLD_PASSWORD_BYTES];
    getrandom::getrandom(&mut password)
        .map_err(|error| AppError::storage_message(error.to_string()))?;

    Ok(password)
}

/// Returns the Stronghold snapshot password, generating a high-entropy random
/// key on first use and persisting it in the OS secure store.
#[cfg_attr(target_os = "macos", allow(dead_code))]
fn stronghold_password() -> AppResult<(Vec<u8>, bool)> {
    let entry = stronghold_keyring_entry()?;

    match entry.get_secret() {
        Ok(secret) if secret.len() == STRONGHOLD_PASSWORD_BYTES => return Ok((secret, false)),
        Ok(_) | Err(keyring::Error::NoEntry) => {}
        Err(error) => return Err(AppError::storage_message(error.to_string())),
    }

    let password = random_stronghold_password()?;
    entry
        .set_secret(&password)
        .map_err(|error| AppError::storage_message(error.to_string()))?;

    Ok((password, true))
}

#[cfg_attr(target_os = "macos", allow(dead_code))]
fn remove_stale_snapshot(path: &Path) -> AppResult<()> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(AppError::from(error)),
    }
}

#[cfg_attr(target_os = "macos", allow(dead_code))]
fn open_stronghold(app: &AppHandle) -> AppResult<Stronghold> {
    let snapshot_path = stronghold_snapshot_path(app)?;
    let (password, created_password) = stronghold_password()?;

    if created_password && snapshot_path.exists() {
        remove_stale_snapshot(&snapshot_path)?;
    }

    Stronghold::new(snapshot_path, password)
        .map_err(|error| AppError::storage_message(error.to_string()))
}

pub(crate) fn load_ai_api_key(app: &AppHandle) -> AppResult<Option<String>> {
    #[cfg(target_os = "macos")]
    {
        let _ = app;
        load_ai_api_key_macos()
    }

    #[cfg(not(target_os = "macos"))]
    with_stronghold_lock(app, || {
        let stronghold = open_stronghold(app)?;
        let client = stronghold
            .get_client(STRONGHOLD_CLIENT_NAME)
            .or_else(|_| stronghold.load_client(STRONGHOLD_CLIENT_NAME))
            .or_else(|_| stronghold.create_client(STRONGHOLD_CLIENT_NAME))
            .map_err(|error| AppError::storage_message(error.to_string()))?;
        let value = client
            .store()
            .get(STRONGHOLD_AI_API_KEY_RECORD_KEY)
            .map_err(|error| AppError::storage_message(error.to_string()))?;

        value
            .map(String::from_utf8)
            .transpose()
            .map_err(|error| AppError::storage_message(error.to_string()))
    })
}

pub(crate) fn save_ai_api_key(app: &AppHandle, api_key: &str) -> AppResult<()> {
    #[cfg(target_os = "macos")]
    {
        let _ = app;
        save_ai_api_key_macos(api_key)
    }

    #[cfg(not(target_os = "macos"))]
    with_stronghold_lock(app, || {
        let stronghold = open_stronghold(app)?;
        let client = stronghold
            .get_client(STRONGHOLD_CLIENT_NAME)
            .or_else(|_| stronghold.load_client(STRONGHOLD_CLIENT_NAME))
            .or_else(|_| stronghold.create_client(STRONGHOLD_CLIENT_NAME))
            .map_err(|error| AppError::storage_message(error.to_string()))?;
        client
            .store()
            .insert(
                STRONGHOLD_AI_API_KEY_RECORD_KEY.to_vec(),
                api_key.as_bytes().to_vec(),
                None,
            )
            .map_err(|error| AppError::storage_message(error.to_string()))?;
        stronghold
            .save()
            .map_err(|error| AppError::storage_message(error.to_string()))?;

        Ok(())
    })
}

#[cfg_attr(target_os = "macos", allow(dead_code))]
fn with_stronghold_lock<T>(
    app: &AppHandle,
    operation: impl FnOnce() -> AppResult<T>,
) -> AppResult<T> {
    let state = app.state::<StrongholdState>();
    let _guard = state
        .lock
        .lock()
        .map_err(|_| std::io::Error::other("Stronghold access failed"))?;

    operation()
}

#[cfg(target_os = "macos")]
fn macos_keyring_entry() -> AppResult<keyring::Entry> {
    keyring::Entry::new(AI_SECRET_SERVICE_NAME, AI_SECRET_ACCOUNT_NAME)
        .map_err(|error| AppError::storage_message(error.to_string()))
}

#[cfg(target_os = "macos")]
fn load_ai_api_key_macos() -> AppResult<Option<String>> {
    match macos_keyring_entry()?.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(AppError::storage_message(error.to_string())),
    }
}

#[cfg(target_os = "macos")]
fn save_ai_api_key_macos(api_key: &str) -> AppResult<()> {
    let entry = macos_keyring_entry()?;
    entry
        .set_password(api_key)
        .map_err(|error| AppError::storage_message(error.to_string()))?;

    match entry.get_password() {
        Ok(saved_api_key) if saved_api_key == api_key => Ok(()),
        Ok(_) => Err(AppError::storage_message(
            "The API key could not be verified after saving it locally.",
        )),
        Err(error) => Err(AppError::storage_message(error.to_string())),
    }
}

#[cfg(target_os = "macos")]
fn clear_ai_api_key_macos() -> AppResult<()> {
    let entry = macos_keyring_entry()?;

    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(AppError::storage_message(error.to_string())),
    }
}
