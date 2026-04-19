use rusqlite::ffi::ErrorCode;
use serde::Serialize;

pub(crate) type AppResult<T> = Result<T, AppError>;

#[derive(Debug, thiserror::Error, Serialize)]
#[serde(tag = "code", rename_all = "SCREAMING_SNAKE_CASE")]
pub(crate) enum AppError {
    #[error("Validation: {message}")]
    Validation {
        message: String,
        field: Option<String>,
    },
    #[error("{entity} not found")]
    NotFound { entity: String },
    #[error("{entity} already exists")]
    Duplicate { entity: String },
    #[error("Storage error: {message}")]
    Storage { message: String },
    #[error("Network error: {message}")]
    Network { message: String },
    #[error("AI provider error: {message}")]
    AiProvider {
        message: String,
        detail: Option<String>,
    },
    #[error("Migration failed: {message}")]
    MigrationFailed { message: String },
    #[error("Internal error: {message}")]
    Internal { message: String },
}

impl AppError {
    pub(crate) fn validation(message: impl Into<String>) -> Self {
        Self::Validation {
            message: message.into(),
            field: None,
        }
    }

    pub(crate) fn validation_field(message: impl Into<String>, field: impl Into<String>) -> Self {
        Self::Validation {
            message: message.into(),
            field: Some(field.into()),
        }
    }

    pub(crate) fn storage_message(message: impl Into<String>) -> Self {
        Self::Storage {
            message: message.into(),
        }
    }

    pub(crate) fn internal_message(message: impl Into<String>) -> Self {
        Self::Internal {
            message: message.into(),
        }
    }

    pub(crate) fn ai_provider(
        message: impl Into<String>,
        detail: Option<impl Into<String>>,
    ) -> Self {
        Self::AiProvider {
            message: message.into(),
            detail: detail.map(Into::into),
        }
    }

    pub(crate) fn migration_failed(message: impl Into<String>) -> Self {
        Self::MigrationFailed {
            message: message.into(),
        }
    }

    pub(crate) fn from_space_storage(error: rusqlite::Error) -> Self {
        match error {
            rusqlite::Error::SqliteFailure(sqlite_error, _)
                if sqlite_error.code == ErrorCode::ConstraintViolation
                    && sqlite_error.extended_code == 2067 =>
            {
                Self::Duplicate {
                    entity: "space".to_string(),
                }
            }
            rusqlite::Error::SqliteFailure(sqlite_error, _)
                if sqlite_error.code == ErrorCode::ConstraintViolation =>
            {
                Self::storage_message("The requested change violates a database constraint.")
            }
            rusqlite::Error::QueryReturnedNoRows => Self::NotFound {
                entity: "space".to_string(),
            },
            other => Self::from(other),
        }
    }

    pub(crate) fn from_card_storage(error: rusqlite::Error) -> Self {
        match error {
            rusqlite::Error::SqliteFailure(sqlite_error, _)
                if sqlite_error.code == ErrorCode::ConstraintViolation =>
            {
                Self::storage_message("The requested change violates a database constraint.")
            }
            rusqlite::Error::QueryReturnedNoRows => Self::NotFound {
                entity: "card".to_string(),
            },
            other => Self::from(other),
        }
    }
}

impl From<std::io::Error> for AppError {
    fn from(error: std::io::Error) -> Self {
        Self::storage_message(error.to_string())
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(error: rusqlite::Error) -> Self {
        Self::storage_message(error.to_string())
    }
}

impl From<reqwest::Error> for AppError {
    fn from(error: reqwest::Error) -> Self {
        Self::Network {
            message: error.to_string(),
        }
    }
}

impl From<tauri::Error> for AppError {
    fn from(error: tauri::Error) -> Self {
        Self::internal_message(error.to_string())
    }
}

#[cfg(target_os = "macos")]
impl From<keyring::Error> for AppError {
    fn from(error: keyring::Error) -> Self {
        Self::storage_message(error.to_string())
    }
}
