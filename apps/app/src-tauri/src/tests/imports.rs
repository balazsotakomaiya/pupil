use crate::imports::import_anki_cards_row;
use crate::tests::support::{open_test_connection, seed_card, seed_space};
use crate::types::{NormalizedImportAnkiCardInput, NormalizedImportAnkiInput};

fn import_card(deck_name: &str, front: &str, back: &str) -> NormalizedImportAnkiCardInput {
    NormalizedImportAnkiCardInput {
        deck_name: deck_name.to_string(),
        front: front.to_string(),
        back: back.to_string(),
        tags: vec!["imported".to_string()],
    }
}

#[test]
fn import_into_existing_target_counts_input_and_persisted_duplicates() {
    let mut connection = open_test_connection();
    seed_space(&connection, "target", "Target", 1);
    seed_card(
        &connection,
        "existing",
        "target",
        "Existing",
        "Answer",
        0,
        1,
        false,
        1,
    );

    let result = import_anki_cards_row(
        &mut connection,
        "deck.apkg",
        NormalizedImportAnkiInput {
            target_space_id: Some("target".to_string()),
            cards: vec![
                import_card("Ignored Deck", "New", "Card"),
                import_card("Ignored Deck", "New", "Card"),
                import_card("Ignored Deck", "Existing", "Answer"),
            ],
        },
    )
    .expect("import into target");

    assert_eq!(result.imported_count, 1);
    assert_eq!(result.duplicate_count, 2);
    assert_eq!(result.created_space_count, 0);
    assert_eq!(result.target_space_id.as_deref(), Some("target"));
    assert_eq!(result.decks[0].total_count, 3);
    assert_eq!(
        connection
            .query_row(
                "SELECT COUNT(*) FROM cards WHERE space_id = 'target'",
                [],
                |row| row.get::<_, i64>(0)
            )
            .unwrap(),
        2
    );
}

#[test]
fn import_creates_one_space_per_deck_and_rolls_back_on_invalid_target() {
    let mut connection = open_test_connection();
    let result = import_anki_cards_row(
        &mut connection,
        "deck.apkg",
        NormalizedImportAnkiInput {
            target_space_id: None,
            cards: vec![
                import_card("Physics", "Force", "Mass times acceleration"),
                import_card("Math", "Pi", "3.14"),
            ],
        },
    )
    .expect("create deck spaces");
    assert_eq!(result.created_space_count, 2);
    assert_eq!(result.deck_count, 2);
    assert_eq!(
        connection
            .query_row("SELECT COUNT(*) FROM spaces", [], |row| row
                .get::<_, i64>(0))
            .unwrap(),
        2
    );

    let result = import_anki_cards_row(
        &mut connection,
        "deck.apkg",
        NormalizedImportAnkiInput {
            target_space_id: Some("missing".to_string()),
            cards: vec![import_card("Nope", "Front", "Back")],
        },
    );
    assert!(result.is_err(), "unknown target rolls back");
    assert_eq!(
        connection
            .query_row("SELECT COUNT(*) FROM cards", [], |row| row.get::<_, i64>(0))
            .unwrap(),
        2
    );
}
