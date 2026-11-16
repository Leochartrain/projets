//! Éditeur de tags : écrit directement dans les fichiers audio.

use anyhow::{anyhow, Result};
use lofty::config::WriteOptions;
use lofty::file::{AudioFile, TaggedFileExt};
use lofty::picture::{MimeType, Picture, PictureType};
use lofty::tag::{Accessor, ItemKey, Tag};
use serde::Deserialize;
use std::path::Path;

/// Champs à modifier. `None` = ne pas toucher ; chaîne vide = effacer le champ.
#[derive(Deserialize, Default, Debug)]
pub struct TagPatch {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album_artist: Option<String>,
    pub album: Option<String>,
    pub genre: Option<String>,
    pub composer: Option<String>,
    pub year: Option<String>,
    pub track_no: Option<String>,
    pub disc_no: Option<String>,
    pub lyrics: Option<String>,
    /// Chemin d'une image à intégrer comme pochette.
    pub cover_path: Option<String>,
    #[serde(default)]
    pub remove_cover: bool,
}

fn set_text(tag: &mut Tag, key: ItemKey, value: &Option<String>) {
    if let Some(v) = value {
        let v = v.trim();
        if v.is_empty() {
            tag.remove_key(key);
        } else {
            tag.insert_text(key, v.to_string());
        }
    }
}

pub fn write(path: &Path, patch: &TagPatch) -> Result<()> {
    let mut tf = lofty::read_from_path(path).map_err(|e| anyhow!("lecture des tags : {e}"))?;
    let tag_type = tf.primary_tag_type();
    if tf.tag(tag_type).is_none() {
        // On reprend un éventuel tag d'un autre type, sinon on en crée un vide.
        let seed = tf.first_tag().cloned();
        let mut tag = Tag::new(tag_type);
        if let Some(old) = seed {
            for item in old.items() {
                tag.insert(item.clone());
            }
            for pic in old.pictures() {
                tag.push_picture(pic.clone());
            }
        }
        tf.insert_tag(tag);
    }
    let tag = tf.tag_mut(tag_type).ok_or_else(|| anyhow!("format de tag non pris en charge"))?;

    if let Some(v) = &patch.title {
        if v.trim().is_empty() { tag.remove_title() } else { tag.set_title(v.trim().to_string()) }
    }
    if let Some(v) = &patch.artist {
        if v.trim().is_empty() { tag.remove_artist() } else { tag.set_artist(v.trim().to_string()) }
    }
    if let Some(v) = &patch.album {
        if v.trim().is_empty() { tag.remove_album() } else { tag.set_album(v.trim().to_string()) }
    }
    if let Some(v) = &patch.genre {
        if v.trim().is_empty() { tag.remove_genre() } else { tag.set_genre(v.trim().to_string()) }
    }
    set_text(tag, ItemKey::AlbumArtist, &patch.album_artist);
    set_text(tag, ItemKey::Composer, &patch.composer);
    set_text(tag, ItemKey::Lyrics, &patch.lyrics);
    if let Some(v) = &patch.year {
        tag.remove_key(ItemKey::Year);
        set_text(tag, ItemKey::RecordingDate, &Some(v.clone()));
    }
    if let Some(v) = &patch.track_no {
        match v.trim().parse::<u32>() {
            Ok(n) => tag.set_track(n),
            Err(_) => tag.remove_track(),
        }
    }
    if let Some(v) = &patch.disc_no {
        match v.trim().parse::<u32>() {
            Ok(n) => tag.set_disk(n),
            Err(_) => tag.remove_disk(),
        }
    }
    if patch.remove_cover {
        while !tag.pictures().is_empty() {
            tag.remove_picture(0);
        }
    }
    if let Some(cover) = &patch.cover_path {
        let data = std::fs::read(cover).map_err(|e| anyhow!("image illisible : {e}"))?;
        let img = image::load_from_memory(&data).map_err(|e| anyhow!("image non reconnue : {e}"))?;
        // Réencodage en JPEG (1400 px max) : poids raisonnable, compatible partout.
        let img = if img.width() > 1400 || img.height() > 1400 {
            img.resize(1400, 1400, image::imageops::FilterType::CatmullRom)
        } else {
            img
        };
        let mut jpeg = Vec::new();
        let enc = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpeg, 92);
        img.to_rgb8().write_with_encoder(enc)?;
        tag.remove_picture_type(PictureType::CoverFront);
        while !tag.pictures().is_empty() {
            tag.remove_picture(0);
        }
        tag.push_picture(Picture::unchecked(jpeg).pic_type(PictureType::CoverFront).mime_type(MimeType::Jpeg).build());
    }

    tf.save_to_path(path, WriteOptions::default()).map_err(|e| anyhow!("écriture impossible : {e}"))?;
    Ok(())
}
