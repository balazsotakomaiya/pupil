use tauri::image::Image;
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager};

use crate::analytics::load_dashboard_stats;
use crate::app::open_app_connection;
use crate::util::now_ms;

const TRAY_ID: &str = "pupil-tray";
const MENU_STATUS_ID: &str = "tray-status";
const MENU_STUDY_ID: &str = "tray-study-now";
const MENU_OPEN_ID: &str = "tray-open";
const MENU_QUIT_ID: &str = "tray-quit";

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
pub(crate) fn refresh_tray(app: &AppHandle) -> Result<(), String> {
    let Some(tray) = app.tray_by_id(TRAY_ID) else {
        return Ok(());
    };

    let connection = open_app_connection(app).map_err(|e| e.to_string())?;
    let now = now_ms();
    let stats = load_dashboard_stats(&connection, now).map_err(|e| e.to_string())?;

    // Cards seen at least once (state > 0) that are 3+ days overdue signal slacking.
    let slack_threshold = now - 3 * 24 * 60 * 60 * 1000;
    let overdue_count: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM cards WHERE state > 0 AND due < ?1",
            [slack_threshold],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let icon = make_status_icon(stats.studied_today, stats.due_today, overdue_count);
    let tooltip = make_tooltip(
        stats.studied_today,
        stats.due_today,
        overdue_count,
        stats.global_streak,
    );

    let status_label = if stats.studied_today > 0 && stats.due_today == 0 {
        format!("All caught up · {} reviewed", stats.studied_today)
    } else if stats.due_today == 0 {
        "No cards due".to_string()
    } else if stats.studied_today == 0 {
        format!("{} cards due today", stats.due_today)
    } else {
        format!("{} due · {} reviewed", stats.due_today, stats.studied_today)
    };

    let study_label = if stats.due_today > 0 {
        format!("Study {} Cards →", stats.due_today)
    } else {
        "Study →".to_string()
    };

    let status_item = MenuItemBuilder::with_id(MENU_STATUS_ID, &status_label)
        .enabled(false)
        .build(app)
        .map_err(|e| e.to_string())?;
    let study_item = MenuItemBuilder::with_id(MENU_STUDY_ID, &study_label)
        .enabled(stats.total_cards > 0)
        .build(app)
        .map_err(|e| e.to_string())?;
    let open_item = MenuItemBuilder::with_id(MENU_OPEN_ID, "Open Pupil")
        .build(app)
        .map_err(|e| e.to_string())?;
    let quit_item = MenuItemBuilder::with_id(MENU_QUIT_ID, "Quit")
        .build(app)
        .map_err(|e| e.to_string())?;

    let menu = MenuBuilder::new(app)
        .item(&status_item)
        .separator()
        .item(&study_item)
        .item(&open_item)
        .separator()
        .item(&quit_item)
        .build()
        .map_err(|e| e.to_string())?;

    let title = if stats.due_today > 0 {
        format!("{} cards to study", stats.due_today)
    } else {
        String::new()
    };

    tray.set_icon(Some(icon)).map_err(|e| e.to_string())?;
    tray.set_tooltip(Some(&tooltip))
        .map_err(|e| e.to_string())?;
    tray.set_title(Some(&title)).map_err(|e| e.to_string())?;
    tray.set_menu(Some(menu)).map_err(|e| e.to_string())?;

    Ok(())
}

/// Returns an eye-shaped icon indicating study status:
/// - Red:    cards are 3+ days overdue — slacking
/// - Amber:  cards are due today — time to study
/// - Green:  all caught up, nothing due
/// - Gray:   no cards yet
fn make_status_icon(studied_today: i64, due_today: i64, overdue_count: i64) -> Image<'static> {
    let (r, g, b) = if overdue_count > 0 {
        (239, 68, 68) // red #ef4444 — slacking, reviews piling up
    } else if studied_today > 0 && due_today == 0 {
        (16, 185, 129) // emerald #10b981 — all done
    } else if due_today > 0 {
        (245, 158, 11) // amber #f59e0b — cards due today
    } else {
        (107, 114, 128) // gray #6b7280 — nothing yet
    };
    make_eye_icon(r, g, b)
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

fn make_tooltip(studied_today: i64, due_today: i64, overdue_count: i64, streak: i64) -> String {
    let streak_part = if streak > 0 {
        format!(" · {} day streak", streak)
    } else {
        String::new()
    };

    if overdue_count > 0 {
        format!(
            "Pupil · {} cards are 3+ days overdue{}",
            overdue_count, streak_part
        )
    } else if studied_today > 0 && due_today == 0 {
        format!("Pupil · All caught up!{}", streak_part)
    } else if due_today > 0 && studied_today == 0 {
        format!("Pupil · {} cards due today{}", due_today, streak_part)
    } else if due_today > 0 {
        format!(
            "Pupil · {} due · {} reviewed{}",
            due_today, studied_today, streak_part
        )
    } else {
        format!("Pupil{}", streak_part)
    }
}

fn focus_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}
