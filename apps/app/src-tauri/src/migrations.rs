use crate::migration_runner::{Migration, MigrationAction};

mod v0006_card_explanation;

use v0006_card_explanation::migrate_card_explanation_payloads;

pub(crate) const MIGRATIONS: &[Migration] = &[
    Migration {
        id: "0001_init",
        requires_backup: false,
        action: MigrationAction::Sql(include_str!("../migrations/0001_init.sql")),
    },
    Migration {
        id: "0002_add_learning_steps",
        requires_backup: true,
        action: MigrationAction::Sql(include_str!("../migrations/0002_add_learning_steps.sql")),
    },
    Migration {
        id: "0003_add_suspended",
        requires_backup: true,
        action: MigrationAction::Sql(include_str!("../migrations/0003_add_suspended.sql")),
    },
    Migration {
        id: "0004_add_card_explanation",
        requires_backup: true,
        action: MigrationAction::Sql(include_str!("../migrations/0004_add_card_explanation.sql")),
    },
    Migration {
        id: "0005_add_card_explanation_payload",
        requires_backup: true,
        action: MigrationAction::Sql(include_str!(
            "../migrations/0005_add_card_explanation_payload.sql"
        )),
    },
    Migration {
        id: "0006_migrate_card_explanation_payloads",
        requires_backup: true,
        action: MigrationAction::Rust(migrate_card_explanation_payloads),
    },
];
