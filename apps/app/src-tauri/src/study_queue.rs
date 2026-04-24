use std::collections::HashMap;

use rusqlite::Connection;

use crate::types::{StudyQueueSnapshot, StudyQueueSpaceCount};

const SLACK_THRESHOLD_MS: i64 = 3 * 24 * 60 * 60 * 1000;

pub(crate) fn load_study_queue_snapshot(
    connection: &Connection,
    now: i64,
    new_cards_limit: Option<i64>,
    new_cards_today: i64,
) -> rusqlite::Result<StudyQueueSnapshot> {
    let slack_threshold = now - SLACK_THRESHOLD_MS;
    let mut remaining_new_budget =
        new_cards_limit.map(|limit| (limit - new_cards_today.max(0)).max(0));
    let mut actionable_due_by_space = HashMap::<String, i64>::new();
    let mut actionable_due_count = 0_i64;
    let mut gated_new_count = 0_i64;
    let mut overdue_review_count = 0_i64;
    let mut statement = connection.prepare(
        "
        SELECT space_id, state, due
        FROM cards
        WHERE due <= ?1
          AND COALESCE(is_suspended, 0) = 0
        ORDER BY due ASC, updated_at DESC, created_at DESC, id ASC
        ",
    )?;
    let mut rows = statement.query([now])?;

    while let Some(row) = rows.next()? {
        let space_id: String = row.get(0)?;
        let state: i64 = row.get(1)?;
        let due: i64 = row.get(2)?;

        if state > 0 {
            actionable_due_count += 1;
            if due < slack_threshold {
                overdue_review_count += 1;
            }
            *actionable_due_by_space.entry(space_id).or_insert(0) += 1;
            continue;
        }

        match remaining_new_budget.as_mut() {
            Some(remaining) if *remaining > 0 => {
                *remaining -= 1;
                actionable_due_count += 1;
                *actionable_due_by_space.entry(space_id).or_insert(0) += 1;
            }
            Some(_) => gated_new_count += 1,
            None => {
                actionable_due_count += 1;
                *actionable_due_by_space.entry(space_id).or_insert(0) += 1;
            }
        }
    }

    let mut actionable_due_by_space = actionable_due_by_space
        .into_iter()
        .map(|(space_id, due_count)| StudyQueueSpaceCount {
            space_id,
            due_count,
        })
        .collect::<Vec<_>>();

    actionable_due_by_space.sort_by(|left, right| {
        right
            .due_count
            .cmp(&left.due_count)
            .then_with(|| left.space_id.cmp(&right.space_id))
    });

    Ok(StudyQueueSnapshot {
        actionable_due_by_space,
        actionable_due_count,
        gated_new_count,
        overdue_review_count,
    })
}
