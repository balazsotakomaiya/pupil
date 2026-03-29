use std::collections::{HashMap, HashSet};

use nanoid::nanoid;
use rusqlite::{params, Connection};

use crate::spaces::{insert_space_identity, load_all_space_identities, touch_space};
use crate::types::{
    ImportAnkiResult, ImportDeckAccumulator, ImportDeckResult, NormalizedImportAnkiCardInput,
};
use crate::util::{encode_tags, now_ms};

pub(crate) fn import_anki_cards_row(
    connection: &mut Connection,
    _source_file_name: &str,
    cards: Vec<NormalizedImportAnkiCardInput>,
) -> rusqlite::Result<ImportAnkiResult> {
    let timestamp = now_ms();
    let transaction = connection.transaction()?;
    let existing_spaces = load_all_space_identities(&transaction)?;
    let mut spaces_by_name = existing_spaces
        .into_iter()
        .map(|space| (space.name.to_ascii_lowercase(), space))
        .collect::<HashMap<_, _>>();
    let mut existing_pairs_by_space = HashMap::<String, HashSet<String>>::new();
    let mut deck_order = Vec::<String>::new();
    let mut deck_stats = HashMap::<String, ImportDeckAccumulator>::new();
    let mut created_space_count = 0_i64;
    let mut touched_space_ids = HashSet::<String>::new();

    for card in cards {
        let deck_key = card.deck_name.to_ascii_lowercase();
        let space = match spaces_by_name.get(&deck_key) {
            Some(existing) => existing.clone(),
            None => {
                let created = insert_space_identity(&transaction, &card.deck_name, timestamp)?;
                spaces_by_name.insert(deck_key.clone(), created.clone());
                created_space_count += 1;
                created
            }
        };

        let existing_pairs = match existing_pairs_by_space.entry(space.id.clone()) {
            std::collections::hash_map::Entry::Occupied(entry) => entry.into_mut(),
            std::collections::hash_map::Entry::Vacant(entry) => {
                entry.insert(load_space_card_pairs(&transaction, &space.id)?)
            }
        };

        let stats = deck_stats.entry(deck_key.clone()).or_insert_with(|| {
            deck_order.push(deck_key.clone());
            ImportDeckAccumulator {
                deck_name: card.deck_name.clone(),
                imported_count: 0,
                skipped_count: 0,
                space_id: space.id.clone(),
                space_name: space.name.clone(),
                total_count: 0,
            }
        });

        stats.total_count += 1;

        let pair_key = card_pair_key(&card.front, &card.back);

        if existing_pairs.contains(&pair_key) {
            stats.skipped_count += 1;
            continue;
        }

        insert_imported_anki_card(
            &transaction,
            &space.id,
            &card.front,
            &card.back,
            &card.tags,
            timestamp,
        )?;
        existing_pairs.insert(pair_key);
        touched_space_ids.insert(space.id.clone());
        stats.imported_count += 1;
    }

    for space_id in touched_space_ids {
        touch_space(&transaction, &space_id, timestamp)?;
    }

    transaction.commit()?;

    let mut decks = Vec::new();

    for deck_key in deck_order {
        if let Some(deck) = deck_stats.remove(&deck_key) {
            decks.push(ImportDeckResult {
                deck_name: deck.deck_name,
                imported_count: deck.imported_count,
                skipped_count: deck.skipped_count,
                space_id: deck.space_id,
                space_name: deck.space_name,
                total_count: deck.total_count,
            });
        }
    }

    let imported_count = decks.iter().map(|deck| deck.imported_count).sum();
    let duplicate_count = decks.iter().map(|deck| deck.skipped_count).sum();

    Ok(ImportAnkiResult {
        created_space_count,
        deck_count: decks.len() as i64,
        decks,
        duplicate_count,
        imported_count,
    })
}

fn load_space_card_pairs(
    transaction: &rusqlite::Transaction<'_>,
    space_id: &str,
) -> rusqlite::Result<HashSet<String>> {
    let mut statement = transaction.prepare(
        "
        SELECT front, back
        FROM cards
        WHERE space_id = ?1
        ",
    )?;
    let rows = statement.query_map([space_id], |row| {
        let front: String = row.get(0)?;
        let back: String = row.get(1)?;
        Ok(card_pair_key(&front, &back))
    })?;

    rows.collect()
}

fn insert_imported_anki_card(
    transaction: &rusqlite::Transaction<'_>,
    space_id: &str,
    front: &str,
    back: &str,
    tags: &[String],
    timestamp: i64,
) -> rusqlite::Result<()> {
    let id = nanoid!(12);
    let tags_json = encode_tags(tags)?;

    transaction.execute(
        "
        INSERT INTO cards (
          id,
          space_id,
          front,
          back,
          tags,
          source,
          state,
          due,
          stability,
          difficulty,
          elapsed_days,
          scheduled_days,
          learning_steps,
          reps,
          lapses,
          last_review,
          created_at,
          updated_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, 'anki', 0, ?6, 0, 0, 0, 0, 0, 0, 0, NULL, ?6, ?6)
        ",
        params![id, space_id, front, back, tags_json, timestamp],
    )?;

    Ok(())
}

fn card_pair_key(front: &str, back: &str) -> String {
    format!("{front}\u{001f}{back}")
}
