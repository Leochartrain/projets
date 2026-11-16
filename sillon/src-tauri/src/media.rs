//! Intégration système : touches multimédia, contrôles média de Windows, Centre de
//! contrôle de macOS, MPRIS sous Linux (crate souvlaki). Tout passe par le fil principal.

use serde::Deserialize;
use souvlaki::{MediaControlEvent, MediaControls, MediaMetadata, MediaPlayback, MediaPosition, PlatformConfig, SeekDirection};
use std::cell::RefCell;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

thread_local! {
    static CONTROLS: RefCell<Option<MediaControls>> = const { RefCell::new(None) };
}

#[derive(Deserialize, Debug)]
pub struct MediaInfo {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub cover: Option<String>,
    pub duration_ms: u64,
    pub position_ms: u64,
    /// "playing", "paused" ou "stopped".
    pub status: String,
    /// Faux : seule la position / l'état a changé.
    pub metadata: bool,
}

/// À appeler une fois, depuis le fil principal, quand la fenêtre existe.
pub fn init(app: &AppHandle) {
    #[cfg(target_os = "windows")]
    let hwnd = app.get_webview_window("main").and_then(|w| w.hwnd().ok()).map(|h| h.0 as *mut std::ffi::c_void);
    #[cfg(not(target_os = "windows"))]
    let hwnd = None;

    let config = PlatformConfig { display_name: "Sillon", dbus_name: "sillon", hwnd };
    let Ok(mut controls) = MediaControls::new(config) else { return };
    let handle = app.clone();
    let attached = controls.attach(move |event: MediaControlEvent| {
        let payload = match event {
            MediaControlEvent::Play => serde_json::json!({ "action": "play" }),
            MediaControlEvent::Pause => serde_json::json!({ "action": "pause" }),
            MediaControlEvent::Toggle => serde_json::json!({ "action": "toggle" }),
            MediaControlEvent::Next => serde_json::json!({ "action": "next" }),
            MediaControlEvent::Previous => serde_json::json!({ "action": "previous" }),
            MediaControlEvent::Stop => serde_json::json!({ "action": "pause" }),
            MediaControlEvent::Seek(dir) => {
                let s = if matches!(dir, SeekDirection::Forward) { 10_000 } else { -10_000 };
                serde_json::json!({ "action": "seek_by", "value": s })
            }
            MediaControlEvent::SeekBy(dir, d) => {
                let ms = d.as_millis() as i64;
                serde_json::json!({ "action": "seek_by", "value": if matches!(dir, SeekDirection::Forward) { ms } else { -ms } })
            }
            MediaControlEvent::SetPosition(MediaPosition(d)) => {
                serde_json::json!({ "action": "seek", "value": d.as_millis() as i64 })
            }
            _ => return,
        };
        let _ = handle.emit("media:key", payload);
    });
    if attached.is_ok() {
        CONTROLS.with(|c| *c.borrow_mut() = Some(controls));
    }
}

pub fn update(app: &AppHandle, info: MediaInfo) {
    let _ = app.run_on_main_thread(move || {
        CONTROLS.with(|c| {
            let mut guard = c.borrow_mut();
            let Some(controls) = guard.as_mut() else { return };
            if info.metadata {
                let cover = info.cover.as_ref().map(|p| format!("file://{}", p.replace('\\', "/")));
                let _ = controls.set_metadata(MediaMetadata {
                    title: Some(&info.title),
                    artist: Some(&info.artist),
                    album: Some(&info.album),
                    cover_url: cover.as_deref(),
                    duration: if info.duration_ms > 0 { Some(Duration::from_millis(info.duration_ms)) } else { None },
                });
            }
            let progress = Some(MediaPosition(Duration::from_millis(info.position_ms)));
            let _ = controls.set_playback(match info.status.as_str() {
                "playing" => MediaPlayback::Playing { progress },
                "paused" => MediaPlayback::Paused { progress },
                _ => MediaPlayback::Stopped,
            });
        });
    });
}
