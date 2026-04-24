use tauri::image::Image;
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager};

use crate::analytics::load_dashboard_stats;
use crate::app::open_app_connection;
use crate::error::{AppError, AppResult};
use crate::settings::{load_new_cards_limit, load_today_new_card_count};
use crate::study_queue::load_study_queue_snapshot;
use crate::util::now_ms;

const TRAY_ID: &str = "pupil-tray";
const MENU_STATUS_ID: &str = "tray-status";
const MENU_STUDY_ID: &str = "tray-study-now";
const MENU_OPEN_ID: &str = "tray-open";
const MENU_QUIT_ID: &str = "tray-quit";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum TrayStatus {
    Empty,
    DueToday,
    Overdue,
    CaughtUp,
}

#[cfg(test)]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) struct TrayQueueCounts {
    pub(crate) admitted_new: i64,
    pub(crate) due_new: i64,
    pub(crate) due_review: i64,
    pub(crate) effective_due: i64,
    pub(crate) gated_new: i64,
    pub(crate) overdue_review: i64,
}

/// Sets up the system tray icon on app startup.
/// The tray starts with a neutral gray icon and "Loading..." status.
/// Call `refresh_tray` after app data is loaded to update it.
pub(crate) fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let status_item = MenuItemBuilder::with_id(MENU_STATUS_ID, "Loading...")
        .enabled(false)
        .build(app)?;
    let study_item = MenuItemBuilder::with_id(MENU_STUDY_ID, "Study Now →").build(app)?;
    let open_item = MenuItemBuilder::with_id(MENU_OPEN_ID, "Open Pupil").build(app)?;
    let quit_item = MenuItemBuilder::with_id(MENU_QUIT_ID, "Quit").build(app)?;

    let menu = MenuBuilder::new(app)
        .item(&status_item)
        .separator()
        .item(&study_item)
        .item(&open_item)
        .separator()
        .item(&quit_item)
        .build()?;

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(make_eye_icon(107, 114, 128)) // gray while loading
        .tooltip("Pupil")
        .title("")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "tray-study-now" => {
                focus_main_window(app);
                let _ = app.emit("tray://study-now", ());
            }
            "tray-open" => {
                focus_main_window(app);
            }
            "tray-quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                ..
            } = event
            {
                focus_main_window(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

/// Queries the DB and updates the tray icon, tooltip, and menu to reflect today's study status.
pub(crate) fn refresh_tray(app: &AppHandle) -> AppResult<()> {
    let Some(tray) = app.tray_by_id(TRAY_ID) else {
        return Ok(());
    };

    let connection = open_app_connection(app)?;
    let now = now_ms();
    let stats = load_dashboard_stats(&connection, now)?;
    let new_cards_limit = load_new_cards_limit(&connection).map_err(AppError::from)?;
    let new_cards_today = load_today_new_card_count(&connection).map_err(AppError::from)?;
    let queue = load_study_queue_snapshot(&connection, now, new_cards_limit, new_cards_today)
        .map_err(AppError::from)?;
    let status = tray_status(
        stats.total_cards,
        queue.actionable_due_count,
        queue.overdue_review_count,
    );
    let icon = make_status_icon(status);
    let tooltip = make_tooltip(
        status,
        stats.studied_today,
        queue.actionable_due_count,
        queue.overdue_review_count,
        queue.gated_new_count,
        stats.global_streak,
    );

    let status_label = match status {
        TrayStatus::Overdue => format!(
            "{} overdue · {} ready now",
            queue.overdue_review_count, queue.actionable_due_count
        ),
        TrayStatus::DueToday => {
            if stats.studied_today == 0 {
                format!("{} cards ready now", queue.actionable_due_count)
            } else {
                format!(
                    "{} ready · {} reviewed",
                    queue.actionable_due_count, stats.studied_today
                )
            }
        }
        TrayStatus::CaughtUp => {
            if queue.gated_new_count > 0 {
                format!("All caught up today · {} new held", queue.gated_new_count)
            } else if stats.studied_today > 0 {
                format!("All caught up · {} reviewed", stats.studied_today)
            } else {
                "All caught up".to_string()
            }
        }
        TrayStatus::Empty => "No cards yet".to_string(),
    };

    let study_label = if queue.actionable_due_count > 0 {
        format!("Study {} Cards →", queue.actionable_due_count)
    } else {
        "Study →".to_string()
    };

    let status_item = MenuItemBuilder::with_id(MENU_STATUS_ID, &status_label)
        .enabled(false)
        .build(app)
        .map_err(AppError::from)?;
    let study_item = MenuItemBuilder::with_id(MENU_STUDY_ID, &study_label)
        .enabled(stats.total_cards > 0)
        .build(app)
        .map_err(AppError::from)?;
    let open_item = MenuItemBuilder::with_id(MENU_OPEN_ID, "Open Pupil")
        .build(app)
        .map_err(AppError::from)?;
    let quit_item = MenuItemBuilder::with_id(MENU_QUIT_ID, "Quit")
        .build(app)
        .map_err(AppError::from)?;

    let menu = MenuBuilder::new(app)
        .item(&status_item)
        .separator()
        .item(&study_item)
        .item(&open_item)
        .separator()
        .item(&quit_item)
        .build()
        .map_err(AppError::from)?;

    let title = if queue.actionable_due_count > 0 {
        format!("{} cards to study", queue.actionable_due_count)
    } else {
        String::new()
    };

    tray.set_icon(Some(icon)).map_err(AppError::from)?;
    tray.set_tooltip(Some(&tooltip)).map_err(AppError::from)?;
    tray.set_title(Some(&title)).map_err(AppError::from)?;
    tray.set_menu(Some(menu)).map_err(AppError::from)?;

    Ok(())
}

/// Returns an eye-shaped icon indicating study status:
/// - Red:    cards are 3+ days overdue — slacking
/// - Amber:  cards are due today — time to study
/// - Green:  all caught up, nothing due
/// - Gray:   no cards yet
pub(crate) fn tray_status(total_cards: i64, due_today: i64, overdue_count: i64) -> TrayStatus {
    if overdue_count > 0 {
        TrayStatus::Overdue
    } else if due_today > 0 {
        TrayStatus::DueToday
    } else if total_cards > 0 {
        TrayStatus::CaughtUp
    } else {
        TrayStatus::Empty
    }
}

fn make_status_icon(status: TrayStatus) -> Image<'static> {
    let (r, g, b) = match status {
        TrayStatus::Overdue => (239, 68, 68), // red #ef4444 — slacking, reviews piling up
        TrayStatus::DueToday => (245, 158, 11), // amber #f59e0b — cards due today
        TrayStatus::CaughtUp => (16, 185, 129), // emerald #10b981 — all done
        TrayStatus::Empty => (107, 114, 128), // gray #6b7280 — nothing yet
    };
    make_eye_icon(r, g, b)
}

#[cfg(test)]
pub(crate) fn load_tray_queue_counts(
    connection: &rusqlite::Connection,
    now: i64,
    new_cards_limit: Option<i64>,
    new_cards_today: i64,
) -> rusqlite::Result<TrayQueueCounts> {
    let slack_threshold = now - 3 * 24 * 60 * 60 * 1000;
    let (due_new, due_review, overdue_review): (i64, i64, i64) = connection.query_row(
        "
        SELECT
          COALESCE(SUM(CASE WHEN state = 0 AND due <= ?1 THEN 1 ELSE 0 END), 0),
          COALESCE(SUM(CASE WHEN state > 0 AND due <= ?1 THEN 1 ELSE 0 END), 0),
          COALESCE(SUM(CASE WHEN state > 0 AND due < ?2 THEN 1 ELSE 0 END), 0)
        FROM cards
        WHERE COALESCE(is_suspended, 0) = 0
        ",
        [now, slack_threshold],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
    )?;

    Ok(build_tray_queue_counts(
        due_new,
        due_review,
        overdue_review,
        new_cards_limit,
        new_cards_today,
    ))
}

#[cfg(test)]
pub(crate) fn build_tray_queue_counts(
    due_new: i64,
    due_review: i64,
    overdue_review: i64,
    new_cards_limit: Option<i64>,
    new_cards_today: i64,
) -> TrayQueueCounts {
    let admitted_new = match new_cards_limit {
        Some(limit) => due_new.min((limit - new_cards_today.max(0)).max(0)),
        None => due_new,
    };
    let effective_due = due_review + admitted_new;

    TrayQueueCounts {
        admitted_new,
        due_new,
        due_review,
        effective_due,
        gated_new: due_new - admitted_new,
        overdue_review,
    }
}

/// Renders a 22×22 eye (almond/lens shape) filled with the given color.
/// The eye is a horizontal ellipse; a small dark pupil sits at the center.
/// This reads clearly at menu-bar size and works on both light and dark bars.
fn make_eye_icon(r: u8, g: u8, b: u8) -> Image<'static> {
    let size = 22u32;
    let cx = 11.0f32;
    let cy = 11.0f32;

    // Eye (lens/almond) ellipse: 19px wide × 11px tall
    let eye_a = 9.5f32;
    let eye_b = 5.5f32;

    // Pupil: small dark circle at center
    let pupil_r = 2.4f32;

    let mut rgba = vec![0u8; (size * size * 4) as usize];

    for y in 0..size {
        for x in 0..size {
            let dx = x as f32 + 0.5 - cx;
            let dy = y as f32 + 0.5 - cy;
            let eye_val = (dx / eye_a).powi(2) + (dy / eye_b).powi(2);

            if eye_val > 1.0 {
                continue; // outside the eye — transparent
            }

            let idx = ((y * size + x) * 4) as usize;
            let dist = (dx * dx + dy * dy).sqrt();

            if dist <= pupil_r {
                // Pupil: near-black
                rgba[idx] = 18;
                rgba[idx + 1] = 18;
                rgba[idx + 2] = 22;
                rgba[idx + 3] = 230;
            } else {
                // Iris / filled eye body
                rgba[idx] = r;
                rgba[idx + 1] = g;
                rgba[idx + 2] = b;
                rgba[idx + 3] = 255;
            }
        }
    }

    Image::new_owned(rgba, size, size)
}

fn make_tooltip(
    status: TrayStatus,
    studied_today: i64,
    due_today: i64,
    overdue_count: i64,
    gated_new: i64,
    streak: i64,
) -> String {
    let streak_part = if streak > 0 {
        format!(" · {} day streak", streak)
    } else {
        String::new()
    };

    match status {
        TrayStatus::Overdue => {
            if gated_new > 0 {
                format!(
                    "Pupil · {} overdue · {} ready now · {} new held by daily limit{}",
                    overdue_count, due_today, gated_new, streak_part
                )
            } else {
                format!(
                    "Pupil · {} overdue · {} ready now{}",
                    overdue_count, due_today, streak_part
                )
            }
        }
        TrayStatus::DueToday => {
            if studied_today == 0 {
                if gated_new > 0 {
                    format!(
                        "Pupil · {} cards ready now · {} new held by daily limit{}",
                        due_today, gated_new, streak_part
                    )
                } else {
                    format!("Pupil · {} cards ready now{}", due_today, streak_part)
                }
            } else {
                if gated_new > 0 {
                    format!(
                        "Pupil · {} ready now · {} reviewed · {} new held by daily limit{}",
                        due_today, studied_today, gated_new, streak_part
                    )
                } else {
                    format!(
                        "Pupil · {} ready now · {} reviewed{}",
                        due_today, studied_today, streak_part
                    )
                }
            }
        }
        TrayStatus::CaughtUp => {
            if gated_new > 0 {
                format!(
                    "Pupil · All caught up for today · {} new held by daily limit{}",
                    gated_new, streak_part
                )
            } else {
                format!("Pupil · All caught up!{}", streak_part)
            }
        }
        TrayStatus::Empty => format!("Pupil{}", streak_part),
    }
}

fn focus_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}
