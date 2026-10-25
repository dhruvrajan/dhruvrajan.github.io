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

  var HEADER_TOKEN_RE = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

  function isByteString(str) {
    var s = String(str || "");
    for (var i = 0; i < s.length; i++) {
      if (s.charCodeAt(i) > 255) return false;
    }
    return true;
  }

  /**
   * Trim fields; if header contains ":", split into name/value.
   * Strip leading "Bearer " from key so it isn't doubled.
   * Returns {url, key, header, errors: {url?, header?, key?}}.
   */
  function normalizeSyncSettings(raw) {
    var url = String((raw && raw.url) || "").trim();
    var key = String((raw && raw.key) || "").trim();
    var header = String((raw && raw.header) || "Authorization").trim();
    var errors = {};

    if (header.indexOf(":") !== -1) {
      var parts = header.split(":");
      header = parts.shift().trim();
      var rest = parts.join(":").trim();
      if (rest && !key) key = rest;
    }
    if (!header) header = "Authorization";
    key = key.replace(/^Bearer\s+/i, "").trim();

    if (url) {
      try {
        var u = new URL(url);
        if (u.protocol !== "http:" && u.protocol !== "https:") {
          errors.url = "URL is invalid";
        }
      } catch (e) {
        errors.url = "URL is invalid";
      }
    }
    if (!HEADER_TOKEN_RE.test(header)) {
      errors.header = "Header name is invalid";
    }
    if (key && !isByteString(key)) {
      errors.key = "Key contains invalid characters";
    }

    return { url: url, key: key, header: header, errors: errors };
  }

  function loadSyncSettings() {
    var s = storageGetJson(SYNC_KEY, {});
    return normalizeSyncSettings({
      url: (s && s.url) || "",
      key: (s && s.key) || "",
      header: (s && s.header) || "Authorization",
    });
  }

  function saveSyncSettings(settings) {
    var norm = normalizeSyncSettings(settings || {});
    storageSetJson(SYNC_KEY, {
      url: norm.url,
      key: norm.key,
      header: norm.header || "Authorization",
    });
    return norm;
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

  function firstFieldError(errors) {
    if (!errors) return "";
    return errors.url || errors.header || errors.key || "";
  }

  function enqueue(payload) {
    var q = loadQueue().filter(function (item) {
      return item && item.slug !== payload.slug;
    });
    q.push(payload);
    saveQueue(q);
  }

  function withKeyInBody(payload, key) {
    var out = {};
    Object.keys(payload || {}).forEach(function (k) {
      out[k] = payload[k];
    });
    if (key) out.key = key;
    return out;
  }

  function urlWithKeyQuery(url, key) {
    if (!key) return url;
    try {
      var u = new URL(url);
      u.searchParams.set("key", key);
      return u.toString();
    } catch (e) {
      return url;
    }
  }

  function classifyFetchError(err) {
    var msg = (err && err.message) || "Network error";
    var offline = typeof navigator !== "undefined" && !navigator.onLine;
    var wrapped = new Error(msg);
    wrapped.offline = offline;
    wrapped.syncTypeError =
      err &&
      (err.name === "TypeError" ||
        /Failed to execute 'fetch'|Invalid.*header|ByteString|URL/i.test(msg));
    wrapped.corsLikely =
      !offline &&
      !wrapped.syncTypeError &&
      /failed to fetch|networkerror|cors|load failed|TypeError/i.test(msg);
    return wrapped;
  }

  function fetchCors(url, settings, payload) {
    return fetch(url, {
      method: "POST",
      headers: authHeaders(settings),
      body: JSON.stringify(payload),
      mode: "cors",
      credentials: "omit",
    }).then(function (res) {
      if (!res.ok) {
        var err = new Error("HTTP " + res.status);
        err.status = res.status;
        throw err;
      }
      return { ok: true, mode: "cors" };
    });
  }

  /** Simple request: no custom headers, so no preflight. */
  function fetchNoCors(url, settings, payload) {
    var bodyObj = withKeyInBody(payload, settings.key);
    var target = urlWithKeyQuery(url, settings.key);
    return fetch(target, {
      method: "POST",
      mode: "no-cors",
      credentials: "omit",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify(bodyObj),
    }).then(function () {
      // Opaque response — cannot confirm, treat as sent.
      return { ok: true, mode: "no-cors", opaque: true };
    });
  }

  function postPayload(payload) {
    var settings = loadSyncSettings();
    if (!settings.url) {
      return Promise.resolve({ ok: false, skipped: true });
    }
    var fieldErr = firstFieldError(settings.errors);
    if (fieldErr) {
      var ve = new Error(fieldErr);
      ve.validation = true;
      ve.errors = settings.errors;
      return Promise.reject(ve);
    }

    var run;
    try {
      run = fetchCors(settings.url, settings, payload);
    } catch (syncErr) {
      return Promise.reject(classifyFetchError(syncErr));
    }

    return run.catch(function (err) {
      var classified = classifyFetchError(err);
      if (classified.offline || classified.validation) throw classified;
      // Invalid fetch init (bad header/URL) → clear field message, no no-cors mask
      if (classified.syncTypeError) {
        var again = loadSyncSettings();
        var fe = firstFieldError(again.errors);
        var ve = new Error(
          fe ||
            (/header/i.test(classified.message)
              ? "Header name is invalid"
              : /url/i.test(classified.message)
                ? "URL is invalid"
                : "Request settings are invalid")
        );
        ve.validation = true;
        ve.errors = again.errors || {};
        throw ve;
      }
      // CORS / network TypeError ("Failed to fetch") → simple no-cors retry
      if (
        classified.corsLikely ||
        (err && err.name === "TypeError")
      ) {
        try {
          return fetchNoCors(settings.url, settings, payload).catch(function (
            err2
          ) {
            throw classifyFetchError(err2);
          });
        } catch (syncErr2) {
          throw classifyFetchError(syncErr2);
        }
      }
      throw classified;
    });
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
      .then(function (res) {
        // drop from queue if present
        saveQueue(
          loadQueue().filter(function (item) {
            return item && item.slug !== slug;
          })
        );
        setStatus(slug, "synced", res && res.opaque ? "Sent" : "Synced");
        return { ok: true, opaque: !!(res && res.opaque) };
      })
      .catch(function (err) {
        if (!(err && err.validation)) enqueue(payload);
        if (err && err.offline) {
          setStatus(slug, "offline", "Offline — queued");
        } else if (err && err.opaque) {
          setStatus(slug, "synced", "Sent");
        } else if (err && err.validation) {
          setStatus(slug, "error", err.message || "Invalid sync settings");
        } else if (err && err.corsLikely) {
          setStatus(
            slug,
            "cors",
            (err.message ? err.message + " — " : "") + "try Export if it persists"
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

  function sendTest() {
    var settings = loadSyncSettings();
    if (!settings.url) {
      return Promise.reject(new Error("Set a webhook URL first"));
    }
    var fieldErr = firstFieldError(settings.errors);
    if (fieldErr) {
      var ve = new Error(fieldErr);
      ve.validation = true;
      ve.errors = settings.errors;
      return Promise.reject(ve);
    }
    var payload = {
      event: "test",
      updated: new Date().toISOString(),
      page_url: (typeof location !== "undefined" && location.href) || "",
    };
    return postPayload(payload).then(function (res) {
      if (res && res.opaque) return { ok: true, message: "Sent (unconfirmed)" };
      return { ok: true, message: "Test sent" };
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
          .then(function (res) {
            saveQueue(
              loadQueue().filter(function (item) {
                return item && item.slug !== payload.slug;
              })
            );
            setStatus(
              payload.slug,
              "synced",
              res && res.opaque ? "Sent" : "Synced"
            );
          })
          .catch(function (err) {
            if (err && err.offline) {
              setStatus(payload.slug, "offline", "Offline — queued");
            } else if (err && err.validation) {
              setStatus(
                payload.slug,
                "error",
                err.message || "Invalid sync settings"
              );
            } else if (err && err.corsLikely) {
              setStatus(
                payload.slug,
                "cors",
                (err.message || "Network error") + " — try Export if it persists"
              );
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
    normalizeSyncSettings: normalizeSyncSettings,
    sendTest: sendTest,
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
