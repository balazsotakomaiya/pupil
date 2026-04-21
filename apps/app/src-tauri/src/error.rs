use rusqlite::ffi::ErrorCode;
use serde::Serialize;

pub(crate) type AppResult<T> = Result<T, AppError>;

/// Represents every backend failure shape the renderer needs to classify and
/// present consistently.
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
    /// Reuses the same SQLite-to-domain mapping for both space and card storage
    /// operations while letting callers opt into duplicate-name detection.
    fn from_entity_storage(
        error: rusqlite::Error,
        entity: &str,
        duplicate_on_unique_constraint: bool,
    ) -> Self {
        match error {
            rusqlite::Error::SqliteFailure(sqlite_error, _)
                if duplicate_on_unique_constraint
                    && sqlite_error.code == ErrorCode::ConstraintViolation
                    && sqlite_error.extended_code == 2067 =>
            {
                Self::Duplicate {
                    entity: entity.to_string(),
                }
            }
            rusqlite::Error::SqliteFailure(sqlite_error, _)
                if sqlite_error.code == ErrorCode::ConstraintViolation =>
            {
                Self::storage_message("The requested change violates a database constraint.")
            }
            rusqlite::Error::QueryReturnedNoRows => Self::NotFound {
                entity: entity.to_string(),
            },
            other => Self::from(other),
        }
    }

    /// Builds a validation error when a request fails general input checks.
    pub(crate) fn validation(message: impl Into<String>) -> Self {
        Self::Validation {
            message: message.into(),
            field: None,
        }
    }

    /// Builds a validation error tied to a specific camelCase field name.
    pub(crate) fn validation_field(message: impl Into<String>, field: impl Into<String>) -> Self {
        Self::Validation {
            message: message.into(),
            field: Some(field.into()),
        }
    }

    /// Wraps storage and filesystem failures in a user-displayable variant.
    pub(crate) fn storage_message(message: impl Into<String>) -> Self {
        Self::Storage {
            message: message.into(),
        }
    }

    /// Wraps unexpected internal failures that should be logged and surfaced as
    /// non-domain issues.
    pub(crate) fn internal_message(message: impl Into<String>) -> Self {
        Self::Internal {
            message: message.into(),
        }
    }

    /// Creates a provider-facing error while optionally preserving a compact
    /// machine-readable detail payload.
    pub(crate) fn ai_provider(
        message: impl Into<String>,
        detail: Option<impl Into<String>>,
    ) -> Self {
        Self::AiProvider {
            message: message.into(),
            detail: detail.map(Into::into),
        }
    }

    /// Marks a startup migration failure separately so the renderer can
    /// distinguish boot errors from runtime command failures.
    pub(crate) fn migration_failed(message: impl Into<String>) -> Self {
        Self::MigrationFailed {
            message: message.into(),
        }
    }

    /// Maps SQLite space-related failures into a structured domain/storage
    /// error for the IPC boundary.
    pub(crate) fn from_space_storage(error: rusqlite::Error) -> Self {
        Self::from_entity_storage(error, "space", true)
    }

    /// Maps card and cross-table card failures into the structured error set
    /// used by the renderer.
    pub(crate) fn from_card_storage(error: rusqlite::Error) -> Self {
        Self::from_entity_storage(error, "card", false)
    }
}

/// Converts filesystem errors into the storage variant used for local data
/// operations.
impl From<std::io::Error> for AppError {
    fn from(error: std::io::Error) -> Self {
        Self::storage_message(error.to_string())
    }
}

/// Converts raw rusqlite errors into the generic storage variant when a more
/// specific mapper is not available.
impl From<rusqlite::Error> for AppError {
    fn from(error: rusqlite::Error) -> Self {
        Self::storage_message(error.to_string())
    }
}

/// Converts outbound HTTP client failures into a dedicated network error.
impl From<reqwest::Error> for AppError {
    fn from(error: reqwest::Error) -> Self {
        Self::Network {
            message: error.to_string(),
        }
    }
}

/// Converts Tauri framework failures into the internal error bucket.
impl From<tauri::Error> for AppError {
    fn from(error: tauri::Error) -> Self {
        Self::internal_message(error.to_string())
    }
}

#[cfg(target_os = "macos")]
/// Converts macOS keyring integration failures into the storage error bucket.
impl From<keyring::Error> for AppError {
    fn from(error: keyring::Error) -> Self {
        Self::storage_message(error.to_string())
    }
}
