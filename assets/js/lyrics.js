(function () {
  "use strict";

  var STORAGE_KEY = "lyrics_cache_key_v2";
  var STORAGE_REMEMBER = "lyrics_cache_remember_v2";
  var STORAGE_TEXT_SIZE = "lyrics_text_size_v1";
  var DECRYPT_CONCURRENCY = 6;

  function baseUrl() {
    var fromDom =
      document.body && document.body.getAttribute("data-lyrics-base");
    if (fromDom) return fromDom.replace(/\/?$/, "/");
    return "/assets/data/lyrics/";
  }

  function saltUrl() {
    return baseUrl() + "salt.json";
  }

  function indexUrl() {
    return baseUrl() + "index.enc.json";
  }

  function songUrl(slug) {
    return baseUrl() + "songs/" + encodeURIComponent(slug) + ".enc.json";
  }

  var state = {
    songs: [],
    salt: null,
    cryptoKey: null,
    songCache: Object.create(null),
    songsMetaBySlug: Object.create(null),
    textSize: "md",
    songbookBusy: false,
  };

  var els = {
    unlockGate: document.getElementById("unlock-gate"),
    unlockForm: document.getElementById("unlock-form"),
    passphraseInput: document.getElementById("passphrase-input"),
    rememberCheck: document.getElementById("remember-check"),
    unlockStatus: document.getElementById("unlock-status"),
    browser: document.getElementById("lyrics-browser"),
    searchForm: document.getElementById("search-form"),
    searchInput: document.getElementById("search-input"),
    status: document.getElementById("search-status"),
    songbookProgress: document.getElementById("songbook-progress"),
    results: document.getElementById("search-results"),
    detail: document.getElementById("song-detail"),
    artistList: document.getElementById("artist-browse"),
    lockBtn: document.getElementById("lock-btn"),
    forgetBtn: document.getElementById("forget-btn"),
    textSizeSm: document.getElementById("text-size-sm"),
    textSizeMd: document.getElementById("text-size-md"),
    textSizeLg: document.getElementById("text-size-lg"),
    printBtn: document.getElementById("print-lyrics-btn"),
    downloadSongbookBtn: document.getElementById("download-songbook-btn"),
  };

  function b64ToBytes(b64) {
    var bin = atob(b64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function bytesToB64(bytes) {
    var bin = "";
    var arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    for (var i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
    return btoa(bin);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /**
   * Title slug matching the lyrics index rule:
   * strip accents, lowercase, runs of non [a-z0-9] → '-', trim, max 80 chars.
   */
  function titleSlug(title) {
    return String(title || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }

  /** Fallback when an index entry has no slug. */
  function slugify(title, artist) {
    var raw = String(title || "") + "-" + String(artist || "");
    return titleSlug(raw);
  }

  function songSlug(song) {
    return song.slug || slugify(song.title, song.artist);
  }

  function setUnlockStatus(message, kind) {
    if (!els.unlockStatus) return;
    els.unlockStatus.textContent = message || "";
    els.unlockStatus.className =
      "lyrics-status" + (kind ? " lyrics-status--" + kind : "");
    els.unlockStatus.hidden = !message;
  }

  function setStatus(message, kind) {
    if (!els.status) return;
    els.status.textContent = message || "";
    els.status.className =
      "lyrics-status" + (kind ? " lyrics-status--" + kind : "");
    els.status.hidden = !message;
  }

  function setSongbookProgress(message, kind) {
    if (!els.songbookProgress) return;
    els.songbookProgress.textContent = message || "";
    els.songbookProgress.className =
      "lyrics-status" + (kind ? " lyrics-status--" + kind : "");
    els.songbookProgress.hidden = !message;
  }

  function showUnlocked(unlocked) {
    if (els.unlockGate) els.unlockGate.hidden = unlocked;
    if (els.browser) els.browser.hidden = !unlocked;
  }

  function readRememberedKey() {
    try {
      if (localStorage.getItem(STORAGE_REMEMBER) !== "1") return null;
      return localStorage.getItem(STORAGE_KEY) || null;
    } catch (e) {
      return null;
    }
  }

  function clearRemembered() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_REMEMBER);
    } catch (e) {
      /* ignore */
    }
  }

  async function rememberKey(cryptoKey) {
    try {
      var raw = await crypto.subtle.exportKey("raw", cryptoKey);
      localStorage.setItem(STORAGE_KEY, bytesToB64(raw));
      localStorage.setItem(STORAGE_REMEMBER, "1");
    } catch (e) {
      throw new Error("Could not save the key in this browser (storage blocked).");
    }
  }

  async function importRawKey(b64) {
    return crypto.subtle.importKey(
      "raw",
      b64ToBytes(b64),
      { name: "AES-GCM" },
      true,
      ["decrypt"]
    );
  }

  async function deriveKey(passphrase, salt, iterations) {
    var enc = new TextEncoder();
    var baseKey = await crypto.subtle.importKey(
      "raw",
      enc.encode(passphrase),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: iterations,
        hash: "SHA-256",
      },
      baseKey,
      { name: "AES-GCM", length: 256 },
      true,
      ["decrypt"]
    );
  }

  async function fetchJson(url) {
    var res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) {
      throw new Error("Could not load " + url + " (" + res.status + ").");
    }
    return res.json();
  }

  async function loadSalt() {
    if (state.salt) return state.salt;
    var data = await fetchJson(saltUrl());
    if (
      !data ||
      data.v !== 2 ||
      data.kdf !== "PBKDF2-SHA256" ||
      !data.salt ||
      !data.iterations
    ) {
      throw new Error("Lyrics salt file is missing required fields.");
    }
    state.salt = data;
    return data;
  }

  async function decryptPayload(cryptoKey, envelope) {
    if (!envelope || !envelope.iv || !envelope.ciphertext) {
      throw new Error("Encrypted payload is missing iv or ciphertext.");
    }
    var iv = b64ToBytes(envelope.iv);
    var combined = b64ToBytes(envelope.ciphertext);
    var plainBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      cryptoKey,
      combined
    );
    return JSON.parse(new TextDecoder().decode(plainBuf));
  }

  function normalizeArtist(artist) {
    var a = String(artist == null ? "" : artist).trim();
    if (!a || /^unknown$/i.test(a)) return "Other";
    return a;
  }

  function normalizeInstrumentName(name) {
    var s = String(name || "").trim();
    if (!s) return "";
    var lower = s.toLowerCase();
    if (lower === "guitar") return "Guitar";
    // mandolin / OM / octave mandolin all map to Octave mandolin in this repertoire
    if (
      lower === "octave mandolin" ||
      lower === "octave-mandolin" ||
      lower === "mandolin" ||
      lower === "om"
    ) {
      return "Octave mandolin";
    }
    if (lower === "banjo") return "Banjo";
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function normalizeInstrumentEntry(inst) {
    if (!inst || typeof inst !== "object") return null;
    var out = { name: normalizeInstrumentName(inst.name) || "Guitar" };
    if (inst.tuning != null && String(inst.tuning).trim() !== "") {
      out.tuning = String(inst.tuning).trim();
    }
    if (inst.capo != null && inst.capo !== "") {
      var capoNum = Number(inst.capo);
      if (!isNaN(capoNum)) out.capo = capoNum;
    }
    if (inst.unverified || inst.tuning_unverified) out.unverified = true;
    if (!out.tuning && out.capo == null) return null;
    return out;
  }

  /** Prefer instruments[]; fall back to flat tuning/capo/tuning_unverified. */
  function instrumentsFromEntry(entry) {
    var list = [];
    if (entry && Array.isArray(entry.instruments)) {
      entry.instruments.forEach(function (inst) {
        var n = normalizeInstrumentEntry(inst);
        if (n) list.push(n);
      });
    }
    if (!list.length && entry) {
      var flat = normalizeInstrumentEntry({
        name: entry.instrument || "Guitar",
        tuning: entry.tuning,
        capo: entry.capo,
        unverified: entry.tuning_unverified || entry.unverified,
      });
      if (flat) list.push(flat);
    }
    return list;
  }

  function orderInstruments(instruments, preferredRaw) {
    var preferred = normalizeInstrumentName(preferredRaw);
    if (!preferred || !instruments.length) return instruments.slice();
    var preferredLower = preferred.toLowerCase();
    var head = [];
    var rest = [];
    instruments.forEach(function (inst) {
      if (String(inst.name).toLowerCase() === preferredLower) head.push(inst);
      else rest.push(inst);
    });
    return head.concat(rest);
  }

  function loadSongsMeta() {
    state.songsMetaBySlug = Object.create(null);
    var el = document.getElementById("songs-meta-json");
    if (!el) return;
    var list;
    try {
      list = JSON.parse(el.textContent || "[]");
    } catch (e) {
      return;
    }
    if (!Array.isArray(list)) return;
    list.forEach(function (entry) {
      if (!entry || !entry.title) return;
      var slug = titleSlug(entry.title);
      if (!slug) return;
      var instruments = orderInstruments(
        instrumentsFromEntry(entry),
        entry.instrument
      );
      var meta = {
        instrument: entry.instrument || "",
        instruments: instruments,
      };
      // Legacy flat fields for older callers / other PRs
      if (instruments.length) {
        meta.tuning = instruments[0].tuning;
        meta.capo = instruments[0].capo;
        meta.tuning_unverified = !!instruments[0].unverified;
      }
      state.songsMetaBySlug[slug] = meta;
    });
  }

  function metaForSong(song) {
    var slug = songSlug(song);
    var bySlug = state.songsMetaBySlug[slug];
    if (bySlug) return bySlug;
    var byTitle = state.songsMetaBySlug[titleSlug(song.title)];
    return byTitle || { instruments: [] };
  }

  function formatInstrumentLine(inst) {
    if (!inst) return "";
    var bits = [];
    if (inst.tuning) {
      bits.push(inst.tuning + (inst.unverified ? "?" : ""));
    }
    if (inst.capo != null && Number(inst.capo) !== 0) {
      bits.push("Capo " + Number(inst.capo));
    }
    if (!bits.length) return "";
    return inst.name + ": " + bits.join(" · ");
  }

  function formatTuningCapo(meta) {
    // Legacy single-line helper (preferred instrument first already ordered)
    if (!meta) return "";
    if (meta.instruments && meta.instruments.length) {
      return meta.instruments
        .map(formatInstrumentLine)
        .filter(Boolean)
        .join("\n");
    }
    var parts = [];
    if (meta.tuning) {
      var tuning = meta.tuning;
      if (meta.tuning_unverified) tuning += "?";
      parts.push("Tuning: " + tuning);
    }
    if (meta.capo != null && Number(meta.capo) !== 0) {
      parts.push("Capo " + Number(meta.capo));
    }
    return parts.join(" · ");
  }

  function tuningCapoHtml(song) {
    var meta = metaForSong(song);
    var instruments =
      meta && meta.instruments && meta.instruments.length
        ? meta.instruments
        : instrumentsFromEntry(meta);
    if (!instruments.length) return "";

    var html = '<div class="song-detail__setup">';
    instruments.forEach(function (inst) {
      html += '<p class="song-detail__setup-line">';
      html += '<span class="song-detail__setup-name">' + escapeHtml(inst.name) + ":</span> ";
      var parts = [];
      if (inst.tuning) {
        var t =
          escapeHtml(inst.tuning) +
          (inst.unverified
            ? '<span class="song-detail__unverified" title="Tuning needs a double-check">?</span>'
            : "");
        parts.push(t);
      }
      if (inst.capo != null && Number(inst.capo) !== 0) {
        parts.push("Capo " + Number(inst.capo));
      }
      html += parts.join(" · ");
      html += "</p>";
    });
    html += "</div>";
    return html;
  }

  function normalizeIndexEntry(entry) {
    var title = (entry && entry.title) || "Untitled";
    var artist = normalizeArtist(entry && entry.artist);
    var slug = (entry && entry.slug) || slugify(title, artist);
    return {
      slug: slug,
      title: title,
      artist: artist,
      source: (entry && entry.source) || "missing",
    };
  }

  async function decryptIndex(cryptoKey) {
    var envelope = await fetchJson(indexUrl());
    var payload;
    try {
      payload = await decryptPayload(cryptoKey, envelope);
    } catch (err) {
      var bad = new Error("WRONG_PASSPHRASE");
      bad.cause = err;
      throw bad;
    }
    if (!Array.isArray(payload)) {
      throw new Error("Decrypted index is not a song list.");
    }
    return payload.map(normalizeIndexEntry);
  }

  async function unlockWithPassphrase(passphrase, remember) {
    var saltInfo = await loadSalt();
    var iterations = Number(saltInfo.iterations) || 310000;
    var salt = b64ToBytes(saltInfo.salt);
    var key = await deriveKey(passphrase, salt, iterations);
    var songs = await decryptIndex(key);
    state.cryptoKey = key;
    state.songs = songs;
    state.songCache = Object.create(null);
    if (remember) {
      await rememberKey(key);
    } else {
      clearRemembered();
    }
    return songs;
  }

  async function unlockWithStoredKey() {
    var b64 = readRememberedKey();
    if (!b64) return false;
    await loadSalt();
    var key = await importRawKey(b64);
    try {
      state.songs = await decryptIndex(key);
      state.cryptoKey = key;
      state.songCache = Object.create(null);
      return true;
    } catch (err) {
      clearRemembered();
      return false;
    }
  }

  async function loadSongDetails(meta) {
    var slug = songSlug(meta);
    if (state.songCache[slug]) return state.songCache[slug];
    if (!state.cryptoKey) {
      throw new Error("Lyrics are locked. Enter the passphrase again.");
    }
    var envelope = await fetchJson(songUrl(slug));
    var payload;
    try {
      payload = await decryptPayload(state.cryptoKey, envelope);
    } catch (err) {
      throw new Error("Could not decrypt lyrics for this song.");
    }
    var details = {
      slug: slug,
      title: payload.title || meta.title || "Untitled",
      artist: normalizeArtist(
        payload.artist != null ? payload.artist : meta.artist
      ),
      source: payload.source || meta.source || "missing",
      lyrics: payload.lyrics == null ? null : String(payload.lyrics),
      doc_name: payload.doc_name || "",
    };
    state.songCache[slug] = details;
    return details;
  }

  async function mapPool(items, limit, worker, onProgress) {
    var results = new Array(items.length);
    var next = 0;
    var done = 0;

    async function run() {
      while (next < items.length) {
        var i = next++;
        results[i] = await worker(items[i], i);
        done++;
        if (onProgress) onProgress(done, items.length);
      }
    }

    var runners = [];
    var n = Math.min(limit, items.length) || 1;
    for (var r = 0; r < n; r++) runners.push(run());
    await Promise.all(runners);
    return results;
  }

  function uniqueArtists(songs) {
    var map = {};
    songs.forEach(function (s) {
      map[s.artist] = true;
    });
    return Object.keys(map).sort(function (a, b) {
      if (a === "Other") return 1;
      if (b === "Other") return -1;
      return a.localeCompare(b);
    });
  }

  function sortedSongs(songs) {
    return songs.slice().sort(function (a, b) {
      var aa = a.artist === "Other" ? "\uffff" : a.artist;
      var ba = b.artist === "Other" ? "\uffff" : b.artist;
      var byArtist = aa.localeCompare(ba);
      if (byArtist) return byArtist;
      return a.title.localeCompare(b.title);
    });
  }

  function filterSongs(query) {
    var q = (query || "").trim().toLowerCase();
    if (!q) return state.songs.slice();
    return state.songs.filter(function (s) {
      return (
        s.title.toLowerCase().indexOf(q) !== -1 ||
        s.artist.toLowerCase().indexOf(q) !== -1
      );
    });
  }

  function applyTextSize() {
    var size = state.textSize || "md";
    if (document.body) {
      document.body.classList.remove(
        "lyrics-text--sm",
        "lyrics-text--md",
        "lyrics-text--lg"
      );
      document.body.classList.add("lyrics-text--" + size);
    }
    if (els.detail) {
      els.detail.classList.toggle("song-detail--large", size !== "sm");
      els.detail.classList.toggle("song-detail--xlarge", size === "lg");
    }
    var map = {
      sm: els.textSizeSm,
      md: els.textSizeMd,
      lg: els.textSizeLg,
    };
    Object.keys(map).forEach(function (key) {
      var btn = map[key];
      if (!btn) return;
      btn.setAttribute("aria-pressed", key === size ? "true" : "false");
    });
    try {
      localStorage.setItem(STORAGE_TEXT_SIZE, size);
    } catch (e) {
      /* ignore */
    }
  }

  function setTextSize(size) {
    state.textSize = size;
    applyTextSize();
  }

  function renderArtistBrowse() {
    if (!els.artistList) return;
    els.artistList.innerHTML = "";
    var artists = uniqueArtists(state.songs);
    if (!artists.length) {
      els.artistList.innerHTML =
        '<p class="lyrics-empty">No songs in the unlocked cache.</p>';
      return;
    }

    artists.forEach(function (artist) {
      var section = document.createElement("section");
      section.className = "group repertoire-group";
      section.setAttribute("aria-label", artist);

      var h = document.createElement("h3");
      h.className = "subheading";
      h.textContent = artist;
      section.appendChild(h);

      var ul = document.createElement("ul");
      ul.className = "song-list repertoire-songs";

      state.songs
        .filter(function (s) {
          return s.artist === artist;
        })
        .forEach(function (song) {
          var li = document.createElement("li");
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "repertoire-song linkish";
          btn.textContent = song.title;
          btn.setAttribute("data-slug", songSlug(song));
          btn.addEventListener("click", function () {
            openSong(song, true);
          });
          li.appendChild(btn);
          ul.appendChild(li);
        });

      section.appendChild(ul);
      els.artistList.appendChild(section);
    });
  }

  function renderResults(songs) {
    if (!els.results) return;
    els.results.innerHTML = "";
    if (!songs.length) {
      els.results.innerHTML =
        '<p class="lyrics-empty">No songs matched that search.</p>';
      return;
    }

    var list = document.createElement("ul");
    list.className = "lyrics-results";
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", "Search results");

    songs.forEach(function (song) {
      var li = document.createElement("li");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "lyrics-result";
      btn.setAttribute("role", "option");
      btn.innerHTML =
        '<span class="lyrics-result__text">' +
        '<span class="lyrics-result__title">' +
        escapeHtml(song.title) +
        "</span>" +
        '<span class="lyrics-result__artist">' +
        escapeHtml(song.artist) +
        "</span>" +
        "</span>";
      btn.addEventListener("click", function () {
        openSong(song, true);
      });
      li.appendChild(btn);
      list.appendChild(li);
    });

    els.results.appendChild(list);
  }

  function findSongBySlug(slug) {
    if (!slug) return null;
    var target = String(slug).toLowerCase();
    for (var i = 0; i < state.songs.length; i++) {
      if (songSlug(state.songs[i]) === target) return state.songs[i];
    }
    return null;
  }

  function setHashForSong(song) {
    var slug = songSlug(song);
    var next = "#song=" + encodeURIComponent(slug);
    if (window.location.hash !== next) {
      history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search + next
      );
    }
  }

  function parseSongHash() {
    var hash = window.location.hash || "";
    if (hash.charAt(0) === "#") hash = hash.slice(1);
    var params = new URLSearchParams(hash);
    var song = params.get("song");
    if (song) return decodeURIComponent(song);
    var m = /(?:^|&)song=([^&]+)/.exec(hash);
    return m ? decodeURIComponent(m[1]) : "";
  }

  function attributionHtml(song) {
    var source = String(song.source || "missing").toLowerCase();
    if (source === "web") {
      return "";
    }
    if (source === "docs") {
      return '<p class="song-detail__copyright">From my lyric docs</p>';
    }
    return (
      '<p class="song-detail__copyright">No lyrics (instrumental or unavailable)</p>'
    );
  }

  function lyricsBodyHtml(song) {
    var source = String(song.source || "missing").toLowerCase();
    if (song.lyrics == null || song.lyrics === "") {
      if (source === "missing") {
        return (
          '<p class="lyrics-empty">No lyrics (instrumental or unavailable)</p>'
        );
      }
      return '<p class="lyrics-empty">No lyrics available for this song.</p>';
    }
    return (
      '<pre class="song-lyrics">' + escapeHtml(song.lyrics) + "</pre>"
    );
  }

  function renderSongDetail(song) {
    if (!els.detail) return;
    els.detail.hidden = false;
    applyTextSize();

    els.detail.innerHTML =
      '<div class="song-detail__header">' +
      '<div class="song-detail__meta">' +
      '<h2 class="song-detail__title">' +
      escapeHtml(song.title) +
      "</h2>" +
      '<p class="song-detail__artist">' +
      escapeHtml(song.artist) +
      "</p>" +
      tuningCapoHtml(song) +
      '<p class="song-detail__actions">' +
      '<button type="button" class="btn btn--secondary" id="back-to-browse">Back to browse</button>' +
      "</p>" +
      "</div></div>" +
      lyricsBodyHtml(song) +
      attributionHtml(song);

    var back = document.getElementById("back-to-browse");
    if (back) {
      back.addEventListener("click", function () {
        els.detail.hidden = true;
        els.detail.innerHTML = "";
        if (window.location.hash) {
          history.replaceState(
            null,
            "",
            window.location.pathname + window.location.search
          );
        }
        if (els.searchInput) els.searchInput.focus();
      });
    }

    els.detail.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openSong(meta, updateHash) {
    if (!meta || !els.detail) return;
    if (updateHash) setHashForSong(meta);

    els.detail.hidden = false;
    applyTextSize();
    els.detail.innerHTML =
      '<p class="lyrics-status lyrics-status--info">Loading lyrics…</p>';

    loadSongDetails(meta)
      .then(function (details) {
        renderSongDetail(details);
      })
      .catch(function (err) {
        els.detail.innerHTML =
          '<p class="lyrics-status lyrics-status--error">' +
          escapeHtml(humanError(err)) +
          "</p>" +
          '<p class="song-detail__actions">' +
          '<button type="button" class="btn btn--secondary" id="back-to-browse">Back to browse</button>' +
          "</p>";
        var back = document.getElementById("back-to-browse");
        if (back) {
          back.addEventListener("click", function () {
            els.detail.hidden = true;
            els.detail.innerHTML = "";
          });
        }
      });
  }

  function runFilter(query) {
    var songs = filterSongs(query);
    var q = (query || "").trim();
    if (q) {
      setStatus(
        songs.length
          ? songs.length + " match" + (songs.length === 1 ? "" : "es")
          : "No matches",
        songs.length ? "ok" : "info"
      );
      renderResults(songs);
    } else {
      setStatus("");
      if (els.results) els.results.innerHTML = "";
    }
  }


  function enrichForSongbook(details) {
    var meta = metaForSong(details);
    var instruments = (meta.instruments || []).slice();
    return {
      slug: details.slug,
      title: details.title,
      artist: details.artist,
      lyrics: details.lyrics,
      source: details.source,
      instrument: meta.instrument || "",
      instruments: instruments,
      // Legacy flat fields (preferred / first instrument)
      tuning: meta.tuning,
      capo: meta.capo,
      tuning_unverified: !!meta.tuning_unverified,
    };
  }

  async function downloadSongbookPdf() {
    if (state.songbookBusy) return;
    if (!state.cryptoKey || !state.songs.length) {
      setSongbookProgress(
        "Unlock lyrics before downloading the songbook.",
        "error"
      );
      return;
    }
    if (!window.DhruvSongbookPdf || typeof window.DhruvSongbookPdf.build !== "function") {
      setSongbookProgress("PDF library failed to load. Refresh and try again.", "error");
      return;
    }
    state.songbookBusy = true;
    if (els.downloadSongbookBtn) els.downloadSongbookBtn.disabled = true;
    setSongbookProgress(
      "Preparing songbook (0/" + state.songs.length + ")…",
      "info"
    );

    try {
      var details = await mapPool(
        state.songs,
        DECRYPT_CONCURRENCY,
        function (meta) {
          return loadSongDetails(meta);
        },
        function (done, total) {
          setSongbookProgress(
            "Decrypting songs (" + done + "/" + total + ")…",
            "info"
          );
        }
      );
      var enriched = details.map(enrichForSongbook);
      setSongbookProgress("Building PDF…", "info");
      var result = window.DhruvSongbookPdf.build(enriched, {
        onProgress: function (msg) {
          setSongbookProgress(msg, "info");
        },
      });
      setSongbookProgress(
        "Downloaded " +
          (result && result.filename ? result.filename : "songbook PDF") +
          " (" +
          (result && result.pages ? result.pages : "?") +
          " pages).",
        "ok"
      );
    } catch (err) {
      setSongbookProgress(humanError(err), "error");
    } finally {
      state.songbookBusy = false;
      if (els.downloadSongbookBtn) els.downloadSongbookBtn.disabled = false;
    }
  }

  function afterUnlock() {
    showUnlocked(true);
    setUnlockStatus("");
    renderArtistBrowse();
    setStatus(
      state.songs.length +
        " song" +
        (state.songs.length === 1 ? "" : "s") +
        " unlocked",
      "ok"
    );

    var slug = parseSongHash();
    if (slug) {
      var song = findSongBySlug(slug);
      if (song) {
        openSong(song, false);
      } else {
        setStatus("No song matched that link in the unlocked cache.", "info");
      }
    }

    if (els.searchInput) {
      var pendingQ = new URLSearchParams(window.location.search).get("q");
      if (pendingQ) {
        els.searchInput.value = pendingQ;
        runFilter(pendingQ);
      }
    }
  }

  function lockSession(forget) {
    state.songs = [];
    state.cryptoKey = null;
    state.songCache = Object.create(null);
    if (forget) clearRemembered();
    if (els.results) els.results.innerHTML = "";
    if (els.artistList) els.artistList.innerHTML = "";
    if (els.detail) {
      els.detail.hidden = true;
      els.detail.innerHTML = "";
    }
    setStatus("");
    setSongbookProgress("");
    showUnlocked(false);
    if (els.passphraseInput) {
      els.passphraseInput.value = "";
      els.passphraseInput.focus();
    }
    setUnlockStatus(
      forget
        ? "Forgotten on this device. Enter the passphrase to unlock again."
        : "Locked. Enter the passphrase to unlock again.",
      "info"
    );
  }

  function humanError(err) {
    if (!err) return "Something went wrong.";
    if (err.message === "WRONG_PASSPHRASE")
      return "Wrong passphrase. Check it and try again.";
    return err.message || "Something went wrong.";
  }

  function bind() {
    if (els.unlockForm) {
      els.unlockForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var passphrase =
          (els.passphraseInput && els.passphraseInput.value) || "";
        if (!passphrase) {
          setUnlockStatus("Enter the passphrase.", "error");
          if (els.passphraseInput) els.passphraseInput.focus();
          return;
        }
        var remember = !!(els.rememberCheck && els.rememberCheck.checked);
        setUnlockStatus("Unlocking…", "info");
        unlockWithPassphrase(passphrase, remember)
          .then(function () {
            if (els.passphraseInput) els.passphraseInput.value = "";
            afterUnlock();
          })
          .catch(function (err) {
            setUnlockStatus(humanError(err), "error");
          });
      });
    }

    if (els.searchForm) {
      els.searchForm.addEventListener("submit", function (e) {
        e.preventDefault();
        runFilter(els.searchInput ? els.searchInput.value : "");
      });
    }

    if (els.searchInput) {
      els.searchInput.addEventListener("input", function () {
        runFilter(els.searchInput.value);
      });
    }

    if (els.lockBtn) {
      els.lockBtn.addEventListener("click", function () {
        lockSession(false);
      });
    }

    if (els.forgetBtn) {
      els.forgetBtn.addEventListener("click", function () {
        if (
          window.confirm(
            "Forget the saved unlock on this device? You will need the passphrase next time."
          )
        ) {
          lockSession(true);
        }
      });
    }

    if (els.textSizeSm) {
      els.textSizeSm.addEventListener("click", function () {
        setTextSize("sm");
      });
    }
    if (els.textSizeMd) {
      els.textSizeMd.addEventListener("click", function () {
        setTextSize("md");
      });
    }
    if (els.textSizeLg) {
      els.textSizeLg.addEventListener("click", function () {
        setTextSize("lg");
      });
    }

    if (els.printBtn) {
      els.printBtn.addEventListener("click", function () {
        window.print();
      });
    }

    if (els.downloadSongbookBtn) {
      els.downloadSongbookBtn.addEventListener("click", function () {
        downloadSongbookPdf();
      });
    }

    window.addEventListener("hashchange", function () {
      if (!state.songs.length) return;
      var slug = parseSongHash();
      if (!slug) return;
      var song = findSongBySlug(slug);
      if (song) openSong(song, false);
    });
  }

  async function init() {
    loadSongsMeta();
    try {
      var savedSize = localStorage.getItem(STORAGE_TEXT_SIZE);
      if (savedSize === "sm" || savedSize === "md" || savedSize === "lg") {
        state.textSize = savedSize;
      }
    } catch (e) {
      /* ignore */
    }
    applyTextSize();
    bind();
    showUnlocked(false);
    setUnlockStatus("Loading lyrics cache…", "info");

    try {
      await loadSalt();
      setUnlockStatus(
        "Enter the passphrase to unlock the lyrics cache.",
        "info"
      );
      var ok = await unlockWithStoredKey();
      if (ok) {
        afterUnlock();
        return;
      }
    } catch (err) {
      setUnlockStatus(humanError(err), "error");
    }

    if (els.passphraseInput) els.passphraseInput.focus();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
