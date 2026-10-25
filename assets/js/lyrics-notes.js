/**
 * Per-song notes (localStorage only) + optional webhook sync.
 * Never written into encrypted lyrics files.
 */
(function (root) {
  "use strict";

  var NOTES_KEY = "lyricsNotes:v1";
  var SYNC_KEY = "lyricsNotesSync:v1";
  var QUEUE_KEY = "lyricsNotesSyncQueue:v1";
  var STATUS_KEY = "lyricsNotesSyncStatus:v1";
  var DEBOUNCE_MS = 3000;

  var debounceTimers = Object.create(null);
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
      updated:
        fields.updated ||
        new Date().toISOString(),
    };
    map[slug] = entry;
    saveNotesMap(map);
    return entry;
  }

  function loadSyncSettings() {
    var s = storageGetJson(SYNC_KEY, {});
    return {
      url: (s && s.url) || "",
      key: (s && s.key) || "",
      header: (s && s.header) || "Authorization",
    };
  }

  function saveSyncSettings(settings) {
    storageSetJson(SYNC_KEY, {
      url: String((settings && settings.url) || "").trim(),
      key: String((settings && settings.key) || ""),
      header: String((settings && settings.header) || "Authorization").trim() ||
        "Authorization",
    });
  }

  function loadQueue() {
    var q = storageGetJson(QUEUE_KEY, []);
    return Array.isArray(q) ? q : [];
  }

  function saveQueue(q) {
    storageSetJson(QUEUE_KEY, q);
  }

  function loadStatusMap() {
    var m = storageGetJson(STATUS_KEY, {});
    return m && typeof m === "object" ? m : {};
  }

  function setStatus(slug, status, detail) {
    var map = loadStatusMap();
    map[slug] = {
      status: status,
      detail: detail || "",
      at: new Date().toISOString(),
    };
    storageSetJson(STATUS_KEY, map);
    notify();
  }

  function getStatus(slug) {
    return loadStatusMap()[slug] || { status: "idle", detail: "" };
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

  function buildSyncPayload(slug, song, entry) {
    var meta =
      song && song.instruments
        ? song
        : Object.assign({}, song || {}, {
            instruments: instrumentsPayload(song),
          });
    return {
      event: "song-note",
      slug: slug,
      title: (entry && entry.title) || (song && song.title) || "",
      artist: (entry && entry.artist) || (song && song.artist) || "",
      notes: (entry && entry.notes) || "",
      instruments: instrumentsPayload(meta),
      updated: (entry && entry.updated) || new Date().toISOString(),
      page_url:
        (typeof location !== "undefined" && location.href) || "",
    };
  }

  function authHeaders(settings) {
    var headers = { "Content-Type": "application/json" };
    if (!settings.key) return headers;
    var name = settings.header || "Authorization";
    if (/^authorization$/i.test(name)) {
      headers[name] = "Bearer " + settings.key;
    } else {
      headers[name] = settings.key;
    }
    return headers;
  }

  function enqueue(payload) {
    var q = loadQueue().filter(function (item) {
      return item && item.slug !== payload.slug;
    });
    q.push(payload);
    saveQueue(q);
  }

  function postPayload(payload) {
    var settings = loadSyncSettings();
    if (!settings.url) {
      return Promise.resolve({ ok: false, skipped: true });
    }
    return fetch(settings.url, {
      method: "POST",
      headers: authHeaders(settings),
      body: JSON.stringify(payload),
      mode: "cors",
      credentials: "omit",
    }).then(
      function (res) {
        if (!res.ok) {
          var err = new Error("HTTP " + res.status);
          err.status = res.status;
          throw err;
        }
        return { ok: true };
      },
      function (err) {
        var msg = (err && err.message) || "Network error";
        var cors =
          /failed to fetch|networkerror|cors|load failed/i.test(msg) ||
          (typeof navigator !== "undefined" && !navigator.onLine);
        var wrapped = new Error(msg);
        wrapped.corsLikely =
          /failed to fetch|cors|networkerror/i.test(msg) &&
          !!(typeof navigator !== "undefined" && navigator.onLine);
        wrapped.offline = typeof navigator !== "undefined" && !navigator.onLine;
        throw wrapped;
      }
    );
  }

  function syncNow(slug, song, entry) {
    var settings = loadSyncSettings();
    if (!settings.url) {
      setStatus(slug, "off", "");
      return Promise.resolve({ ok: false, skipped: true });
    }
    if (!entry || !String(entry.notes || "").trim()) {
      setStatus(slug, "idle", "");
      return Promise.resolve({ ok: true, cleared: true });
    }
    var payload = buildSyncPayload(slug, song, entry);
    setStatus(slug, "pending", "Syncing…");
    return postPayload(payload)
      .then(function () {
        // drop from queue if present
        saveQueue(
          loadQueue().filter(function (item) {
            return item && item.slug !== slug;
          })
        );
        setStatus(slug, "synced", "Synced");
        return { ok: true };
      })
      .catch(function (err) {
        enqueue(payload);
        if (err && err.offline) {
          setStatus(slug, "offline", "Offline — queued");
        } else if (err && err.corsLikely) {
          setStatus(
            slug,
            "cors",
            "CORS blocked — use Export"
          );
        } else {
          setStatus(
            slug,
            "error",
            (err && err.message) || "Not synced"
          );
        }
        return { ok: false, error: err };
      });
  }

  function flushQueue() {
    var settings = loadSyncSettings();
    if (!settings.url) return Promise.resolve();
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return Promise.resolve();
    }
    var q = loadQueue().slice();
    if (!q.length) return Promise.resolve();
    var chain = Promise.resolve();
    q.forEach(function (payload) {
      chain = chain.then(function () {
        return postPayload(payload)
          .then(function () {
            saveQueue(
              loadQueue().filter(function (item) {
                return item && item.slug !== payload.slug;
              })
            );
            setStatus(payload.slug, "synced", "Synced");
          })
          .catch(function (err) {
            if (err && err.offline) {
              setStatus(payload.slug, "offline", "Offline — queued");
            } else if (err && err.corsLikely) {
              setStatus(payload.slug, "cors", "CORS blocked — use Export");
            } else {
              setStatus(
                payload.slug,
                "error",
                (err && err.message) || "Not synced"
              );
            }
          });
      });
    });
    return chain;
  }

  function scheduleSync(slug, song, entry) {
    if (debounceTimers[slug]) clearTimeout(debounceTimers[slug]);
    debounceTimers[slug] = setTimeout(function () {
      delete debounceTimers[slug];
      syncNow(slug, song, getNote(slug) || entry);
    }, DEBOUNCE_MS);
  }

  function saveNoteAndSync(slug, fields, song, opts) {
    opts = opts || {};
    var entry = setNote(slug, fields);
    if (opts.immediate) {
      if (debounceTimers[slug]) {
        clearTimeout(debounceTimers[slug]);
        delete debounceTimers[slug];
      }
      return syncNow(slug, song, entry);
    }
    scheduleSync(slug, song, entry);
    return Promise.resolve({ ok: true, deferred: true });
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
              instrumentsPayload(
                song.meta || song
              ),
          })
        : { title: entry.title, artist: entry.artist, instruments: [] };
      // Prefer live meta instruments when a resolver provides them
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
        prev.updated > incomingUpdated &&
        String(prev.notes || "") === notes
      ) {
        return;
      }
      // Prefer newer updated, else overwrite with import
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

  if (typeof window !== "undefined") {
    window.addEventListener("online", function () {
      flushQueue();
    });
  }

  root.LyricsNotes = {
    NOTES_KEY: NOTES_KEY,
    getNote: getNote,
    hasNotes: hasNotes,
    setNote: setNote,
    saveNoteAndSync: saveNoteAndSync,
    syncNow: syncNow,
    flushQueue: flushQueue,
    loadSyncSettings: loadSyncSettings,
    saveSyncSettings: saveSyncSettings,
    getStatus: getStatus,
    setStatus: setStatus,
    buildExportObject: buildExportObject,
    downloadExport: downloadExport,
    copyExport: copyExport,
    shareExport: shareExport,
    importNotesJson: importNotesJson,
    onChange: onChange,
    instrumentsPayload: instrumentsPayload,
  };
})(typeof window !== "undefined" ? window : globalThis);
