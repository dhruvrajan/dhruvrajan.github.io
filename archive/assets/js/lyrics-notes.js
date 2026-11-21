/**
 * Per-song notes (localStorage only). Export / import / copy / share.
 * Never written into encrypted lyrics files.
 */
(function (root) {
  "use strict";

  var NOTES_KEY = "lyricsNotes:v1";
  var listeners = [];

  function storageGetJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (e) {
      return fallback;
    }
  }

  function storageSetJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  function loadNotesMap() {
    var map = storageGetJson(NOTES_KEY, {});
    return map && typeof map === "object" ? map : {};
  }

  function saveNotesMap(map) {
    storageSetJson(NOTES_KEY, map);
    notify();
  }

  function notify() {
    listeners.forEach(function (fn) {
      try {
        fn();
      } catch (e) {
        /* ignore */
      }
    });
  }

  function onChange(fn) {
    listeners.push(fn);
    return function () {
      listeners = listeners.filter(function (f) {
        return f !== fn;
      });
    };
  }

  function getNote(slug) {
    if (!slug) return null;
    var entry = loadNotesMap()[slug];
    return entry && typeof entry === "object" ? entry : null;
  }

  function hasNotes(slug) {
    var entry = getNote(slug);
    return !!(entry && String(entry.notes || "").trim());
  }

  function setNote(slug, fields) {
    if (!slug) return null;
    var map = loadNotesMap();
    var prev = map[slug] || {};
    var notes = fields.notes == null ? prev.notes || "" : String(fields.notes);
    if (!String(notes).trim()) {
      delete map[slug];
      saveNotesMap(map);
      return null;
    }
    var entry = {
      title: fields.title != null ? String(fields.title) : prev.title || "",
      artist: fields.artist != null ? String(fields.artist) : prev.artist || "",
      notes: notes,
      updated: fields.updated || new Date().toISOString(),
    };
    map[slug] = entry;
    saveNotesMap(map);
    return entry;
  }

  function instrumentsPayload(songOrMeta) {
    var Setup = root.LyricsSetup;
    var list = [];
    if (Setup && typeof Setup.normalizeInstruments === "function") {
      list = Setup.normalizeInstruments(songOrMeta) || [];
    } else if (songOrMeta && Array.isArray(songOrMeta.instruments)) {
      list = songOrMeta.instruments;
    }
    return list.map(function (inst) {
      return {
        name: inst.name || "Guitar",
        tuning: inst.tuning || "",
        capo: inst.capo != null ? inst.capo : null,
        unverified: !!inst.unverified,
      };
    });
  }

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function exportFilename() {
    var d = new Date();
    return (
      "lyrics-notes-" +
      d.getFullYear() +
      "-" +
      pad2(d.getMonth() + 1) +
      "-" +
      pad2(d.getDate()) +
      ".json"
    );
  }

  function buildExportObject(getSongBySlug) {
    var map = loadNotesMap();
    var notes = [];
    Object.keys(map).forEach(function (slug) {
      var entry = map[slug];
      if (!entry || !String(entry.notes || "").trim()) return;
      var song =
        typeof getSongBySlug === "function" ? getSongBySlug(slug) : null;
      var meta = song
        ? Object.assign({}, song, {
            instruments:
              song.instruments ||
              instrumentsPayload(song.meta || song),
          })
        : { title: entry.title, artist: entry.artist, instruments: [] };
      if (song && song._instruments) {
        meta.instruments = song._instruments;
      }
      notes.push({
        slug: slug,
        title: entry.title || meta.title || "",
        artist: entry.artist || meta.artist || "",
        notes: entry.notes,
        updated: entry.updated || "",
        instruments: instrumentsPayload(
          song && song._meta ? song._meta : meta
        ),
      });
    });
    return {
      exported_at: new Date().toISOString(),
      count: notes.length,
      notes: notes,
    };
  }

  function downloadExport(obj) {
    var blob = new Blob([JSON.stringify(obj, null, 2)], {
      type: "application/json",
    });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = exportFilename();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function copyExport(obj) {
    var text = JSON.stringify(obj, null, 2);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        resolve();
      } catch (e) {
        reject(e);
      } finally {
        ta.remove();
      }
    });
  }

  function shareExport(obj) {
    var text = JSON.stringify(obj, null, 2);
    var filename = exportFilename();
    if (!navigator.share) {
      return Promise.reject(new Error("Share unavailable"));
    }
    try {
      var file = new File([text], filename, { type: "application/json" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        return navigator.share({
          files: [file],
          title: "Lyrics notes",
        });
      }
    } catch (e) {
      /* fall through */
    }
    return navigator.share({ title: "Lyrics notes", text: text });
  }

  function importNotesJson(raw) {
    var data = typeof raw === "string" ? JSON.parse(raw) : raw;
    var list = [];
    if (Array.isArray(data)) list = data;
    else if (data && Array.isArray(data.notes)) list = data.notes;
    else throw new Error("Unrecognized notes JSON");

    var map = loadNotesMap();
    var imported = 0;
    list.forEach(function (item) {
      if (!item || !item.slug) return;
      var notes = String(item.notes || "");
      if (!notes.trim()) return;
      var prev = map[item.slug];
      var incomingUpdated = item.updated || "";
      if (
        prev &&
        prev.updated &&
        incomingUpdated &&
        prev.updated > incomingUpdated
      ) {
        return;
      }
      map[item.slug] = {
        title: item.title || (prev && prev.title) || "",
        artist: item.artist || (prev && prev.artist) || "",
        notes: notes,
        updated: incomingUpdated || new Date().toISOString(),
      };
      imported += 1;
    });
    saveNotesMap(map);
    return imported;
  }

  root.LyricsNotes = {
    NOTES_KEY: NOTES_KEY,
    getNote: getNote,
    hasNotes: hasNotes,
    setNote: setNote,
    buildExportObject: buildExportObject,
    downloadExport: downloadExport,
    copyExport: copyExport,
    shareExport: shareExport,
    importNotesJson: importNotesJson,
    onChange: onChange,
    instrumentsPayload: instrumentsPayload,
  };
})(typeof window !== "undefined" ? window : globalThis);
