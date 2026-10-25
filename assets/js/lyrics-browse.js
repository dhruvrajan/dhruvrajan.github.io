/**
 * Stage-friendly lyrics browse UI for iPad / venue use.
 * Mounts after LyricsApp unlock; does not touch crypto.
 */
(function () {
  "use strict";

  var STAGE_KEY = "lyrics_browse_stage_v1";
  var RECENT_KEY = "lyrics_browse_recent_v1";
  var SETLIST_KEY = "lyrics_browse_setlist_v1";
  var SORT_KEY = "lyrics_browse_sort_v1";
  var SPEED_KEY = "lyrics_browse_scroll_speed_v1";
  var FILTERS_OPEN_KEY = "lyrics_browse_filters_open_v1";
  var LAYOUT_KEY = "lyrics_browse_layout_v1";
  var PREFETCH_CONCURRENCY = 4;
  var TEXT_SIZES = ["sm", "md", "lg"];
  var LAYOUT_MODES = ["auto", "desktop", "touch"];
  var INSTRUMENTS = ["Guitar", "Octave mandolin", "Banjo"];
  var INSTRUMENT_KEY = "lyrics_browse_instrument_v1";

  var api = null;
  var root = null;
  var state = {
    sort: "artist",
    query: "",
    instrumentFilter: "Guitar",
    tuningFilter: "all",
    capoFilter: "all",
    artistFilter: "all",
    stage: false,
    filtersOpen: false,
    layoutMode: "auto",
    recent: [],
    setlist: [],
    order: [],
    currentSlug: null,
    prefetch: { done: 0, total: 0, state: "idle", error: "" },
    autoScroll: false,
    scrollSpeed: 35,
    wakeLock: null,
    swipeStartX: 0,
    swipeStartY: 0,
    prefetchAbort: false,
  };

  var els = {};
  var scrollTimer = null;
  var metaByTitleSlug = Object.create(null);

  function $(sel, ctx) {
    return (ctx || document).querySelector(sel);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** Title slug: accents stripped, lower, non [a-z0-9] → -, trim, max 80. */
  function titleSlug(title) {
    return String(title || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }

  function storageGet(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      return v == null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      /* ignore */
    }
  }

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
    storageSet(key, JSON.stringify(value));
  }

  function loadPrefs() {
    state.stage = storageGet(STAGE_KEY, "0") === "1";
    state.sort = storageGet(SORT_KEY, "artist") || "artist";
    var inst = storageGet(INSTRUMENT_KEY, "Guitar") || "Guitar";
    state.instrumentFilter =
      INSTRUMENTS.indexOf(inst) !== -1 || inst === "all" ? inst : "Guitar";
    var speed = Number(storageGet(SPEED_KEY, "35"));
    state.scrollSpeed = isNaN(speed) ? 35 : Math.min(120, Math.max(8, speed));
    state.filtersOpen = storageGet(FILTERS_OPEN_KEY, "0") === "1";
    var layout = storageGet(LAYOUT_KEY, "auto") || "auto";
    state.layoutMode =
      LAYOUT_MODES.indexOf(layout) !== -1 ? layout : "auto";
    var recent = storageGetJson(RECENT_KEY, []);
    state.recent = Array.isArray(recent) ? recent.slice(0, 40) : [];
    var setlist = storageGetJson(SETLIST_KEY, []);
    state.setlist = Array.isArray(setlist) ? setlist.slice(0, 40) : [];
  }

  function detectTouchPreferred() {
    try {
      if (
        window.matchMedia &&
        (window.matchMedia("(pointer: coarse)").matches ||
          window.matchMedia("(hover: none)").matches)
      ) {
        return true;
      }
    } catch (e) {
      /* ignore */
    }
    var ua = (navigator && navigator.userAgent) || "";
    var maxTp = (navigator && navigator.maxTouchPoints) || 0;
    if (maxTp > 1 && /Macintosh|Mac OS X/i.test(ua)) return true;
    if (/iPhone|iPad|iPod|Android.*Mobile|Mobile.*Android/i.test(ua)) {
      return true;
    }
    return false;
  }

  function effectiveLayout() {
    if (state.layoutMode === "desktop") return "desktop";
    if (state.layoutMode === "touch") return "touch";
    return detectTouchPreferred() ? "touch" : "desktop";
  }

  function applyLayoutClass() {
    var layout = effectiveLayout();
    var isDesktop = layout === "desktop";
    if (root) {
      root.classList.toggle("lb-layout-desktop", isDesktop);
      root.classList.toggle("lb-layout-touch", !isDesktop);
      root.setAttribute("data-lb-layout", layout);
    }
    document.body.classList.toggle("lb-layout-desktop", isDesktop);
    document.body.classList.toggle("lb-layout-touch", !isDesktop);
  }

  function activeFilterCount() {
    var n = 0;
    if (state.instrumentFilter && state.instrumentFilter !== "Guitar") n += 1;
    if (state.tuningFilter && state.tuningFilter !== "all") n += 1;
    if (state.capoFilter && state.capoFilter !== "all") n += 1;
    if (state.artistFilter && state.artistFilter !== "all") n += 1;
    return n;
  }

  function updateFiltersToggle() {
    var btn = els.filtersToggle || (root && $("#lb-filters-toggle", root));
    if (!btn) return;
    var n = activeFilterCount();
    btn.textContent = n ? "Filters (" + n + ")" : "Filters";
    btn.setAttribute("aria-expanded", state.filtersOpen ? "true" : "false");
    btn.setAttribute("aria-pressed", state.filtersOpen ? "true" : "false");
    if (els.filtersPanel) {
      els.filtersPanel.hidden = !state.filtersOpen;
    }
  }

  function setFiltersOpen(open) {
    state.filtersOpen = !!open;
    storageSet(FILTERS_OPEN_KEY, state.filtersOpen ? "1" : "0");
    updateFiltersToggle();
  }

  function setLayoutMode(mode) {
    if (LAYOUT_MODES.indexOf(mode) === -1) mode = "auto";
    state.layoutMode = mode;
    storageSet(LAYOUT_KEY, mode);
    applyLayoutClass();
    syncLayoutMenu();
    if (state.currentSlug) {
      applySongPaneVisibility();
    }
  }

  function syncLayoutMenu() {
    if (!root) return;
    root.querySelectorAll("[data-layout-mode]").forEach(function (btn) {
      btn.setAttribute(
        "aria-pressed",
        btn.getAttribute("data-layout-mode") === state.layoutMode
          ? "true"
          : "false"
      );
    });
  }

  function applySongPaneVisibility() {
    if (!els.browse) return;
    var desktop = effectiveLayout() === "desktop";
    if (state.currentSlug && desktop) {
      els.browse.classList.remove("lb-hidden");
    } else if (state.currentSlug) {
      els.browse.classList.add("lb-hidden");
    } else {
      els.browse.classList.remove("lb-hidden");
    }
  }

  function loadSongsMetaFallback() {
    metaByTitleSlug = Object.create(null);
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
      var meta = {};
      if (entry.tuning != null && String(entry.tuning).trim() !== "") {
        meta.tuning = String(entry.tuning).trim();
      }
      if (entry.capo != null && entry.capo !== "") {
        var capoNum = Number(entry.capo);
        if (!isNaN(capoNum)) meta.capo = capoNum;
      }
      if (entry.tuning_unverified === true || entry.tuning_unverified === "true") {
        meta.tuning_unverified = true;
      }
      if (Array.isArray(entry.instruments) && entry.instruments.length) {
        meta.instruments = entry.instruments;
      }
      metaByTitleSlug[slug] = meta;
    });
  }

  function songSlug(song) {
    if (api && typeof api.songSlug === "function") return api.songSlug(song);
    return song && song.slug ? song.slug : titleSlug(song && song.title);
  }

  function metaForSong(song) {
    if (!song) return {};
    if (api && typeof api.metaForSong === "function") {
      return api.metaForSong(song) || {};
    }
    var byTitle = metaByTitleSlug[titleSlug(song.title)];
    if (byTitle) return byTitle;
    var bySlug = metaByTitleSlug[songSlug(song)];
    return bySlug || {};
  }

  /** Flat tuning/capo → Guitar; or instruments[{name,tuning,capo,unverified}]. */
  function normalizeInstruments(meta) {
    if (api && typeof api.normalizeInstruments === "function") {
      return api.normalizeInstruments(meta) || [];
    }
    meta = meta || {};
    function one(entry) {
      if (!entry || typeof entry !== "object") return null;
      var name = String(entry.name || "").trim() || "Guitar";
      var tuning =
        entry.tuning != null && String(entry.tuning).trim() !== ""
          ? String(entry.tuning).trim()
          : "";
      var capo = null;
      if (entry.capo != null && entry.capo !== "") {
        var n = Number(entry.capo);
        if (!isNaN(n)) capo = n;
      }
      var unverified = !!(
        entry.unverified === true ||
        entry.unverified === "true" ||
        entry.tuning_unverified === true ||
        entry.tuning_unverified === "true"
      );
      return { name: name, tuning: tuning, capo: capo, unverified: unverified };
    }
    if (Array.isArray(meta.instruments) && meta.instruments.length) {
      return meta.instruments.map(one).filter(Boolean);
    }
    var hasFlat =
      (meta.tuning != null && String(meta.tuning).trim() !== "") ||
      (meta.capo != null && meta.capo !== "") ||
      meta.tuning_unverified === true ||
      meta.tuning_unverified === "true";
    if (hasFlat) {
      return [
        one({
          name: "Guitar",
          tuning: meta.tuning,
          capo: meta.capo,
          unverified: meta.tuning_unverified,
        }),
      ];
    }
    return [];
  }

  function instrumentsOf(song) {
    return normalizeInstruments(metaForSong(song));
  }

  function activeInstrumentName() {
    return state.instrumentFilter || "Guitar";
  }

  function setupForSong(song) {
    var list = instrumentsOf(song);
    var want = activeInstrumentName();
    if (want === "all") {
      for (var i = 0; i < list.length; i++) {
        if (list[i].name === "Guitar") return list[i];
      }
      return list[0] || null;
    }
    for (var j = 0; j < list.length; j++) {
      if (list[j].name === want) return list[j];
    }
    return null;
  }

  function songHasInstrument(song, name) {
    if (!name || name === "all") return true;
    var list = instrumentsOf(song);
    if (!list.length) {
      // No setup metadata: treat as Guitar repertoire so the list isn't empty.
      return name === "Guitar";
    }
    return list.some(function (inst) {
      return inst.name === name;
    });
  }

  function tuningOf(song) {
    var inst = setupForSong(song);
    return inst && inst.tuning ? String(inst.tuning) : "";
  }

  function tuningUnverified(song) {
    var inst = setupForSong(song);
    return !!(inst && inst.unverified);
  }

  function capoOf(song) {
    var inst = setupForSong(song);
    if (!inst || inst.capo == null || inst.capo === "") return null;
    var n = Number(inst.capo);
    return isNaN(n) ? null : n;
  }

  function tuningLabel(song) {
    return tuningOf(song) || "Unspecified";
  }

  function tuningDisplay(song) {
    var t = tuningOf(song);
    if (!t) return "";
    return t + (tuningUnverified(song) ? "?" : "");
  }

  function formatSetup(song) {
    var list = instrumentsOf(song);
    var preferred =
      activeInstrumentName() === "all" ? "" : activeInstrumentName();
    if (window.LyricsSetup && window.LyricsSetup.formatSetupCompact) {
      return window.LyricsSetup.formatSetupCompact(
        { instruments: list },
        preferred || null
      );
    }
    var parts = [];
    var tuning = tuningDisplay(song);
    var capo = capoOf(song);
    if (tuning) parts.push(tuning);
    if (capo != null && capo !== 0) parts.push("Capo " + capo);
    return parts.join(" · ");
  }

  function notesApi() {
    return window.LyricsNotes || null;
  }

  function songHasNotes(slug) {
    var N = notesApi();
    return !!(N && N.hasNotes(slug));
  }

  function exportNotesBundle() {
    var N = notesApi();
    if (!N) return null;
    return N.buildExportObject(function (slug) {
      var song = songs().filter(function (s) {
        return songSlug(s) === slug;
      })[0];
      if (!song) return null;
      return {
        title: song.title,
        artist: song.artist,
        _meta: metaForSong(song),
        _instruments: instrumentsOf(song),
      };
    });
  }

  function songs() {
    return api && typeof api.getSongs === "function" ? api.getSongs() : [];
  }

  function uniqueSorted(values) {
    var map = Object.create(null);
    values.forEach(function (v) {
      if (v) map[v] = true;
    });
    return Object.keys(map).sort(function (a, b) {
      return a.localeCompare(b, undefined, { sensitivity: "base" });
    });
  }

  function compareTitle(a, b) {
    return String(a.title || "").localeCompare(String(b.title || ""), undefined, {
      sensitivity: "base",
    });
  }

  function compareArtist(a, b) {
    var aa = String(a.artist || "");
    var bb = String(b.artist || "");
    if (aa === "Other" && bb !== "Other") return 1;
    if (bb === "Other" && aa !== "Other") return -1;
    var c = aa.localeCompare(bb, undefined, { sensitivity: "base" });
    return c || compareTitle(a, b);
  }

  function recentIndex(slug) {
    var i = state.recent.indexOf(slug);
    return i === -1 ? 9999 : i;
  }

  function filteredSongs() {
    var q = (state.query || "").trim().toLowerCase();
    return songs().filter(function (s) {
      if (!songHasInstrument(s, activeInstrumentName())) return false;
      if (q) {
        var hay =
          String(s.title || "").toLowerCase() +
          " " +
          String(s.artist || "").toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      if (state.artistFilter !== "all" && s.artist !== state.artistFilter) {
        return false;
      }
      if (state.tuningFilter !== "all") {
        if (tuningLabel(s) !== state.tuningFilter) return false;
      }
      if (state.capoFilter !== "all") {
        var c = capoOf(s);
        if (state.capoFilter === "none") {
          if (c != null && c !== 0) return false;
        } else if (String(c) !== state.capoFilter) {
          return false;
        }
      }
      return true;
    });
  }

  function sortedSongs() {
    var list = filteredSongs().slice();
    if (state.sort === "title") {
      list.sort(compareTitle);
    } else if (state.sort === "tuning") {
      list.sort(function (a, b) {
        var ta = tuningLabel(a);
        var tb = tuningLabel(b);
        var c = ta.localeCompare(tb, undefined, { sensitivity: "base" });
        return c || compareArtist(a, b);
      });
    } else if (state.sort === "capo") {
      list.sort(function (a, b) {
        var ca = capoOf(a);
        var cb = capoOf(b);
        var na = ca == null ? 0 : ca;
        var nb = cb == null ? 0 : cb;
        if (na !== nb) return na - nb;
        return compareArtist(a, b);
      });
    } else if (state.sort === "recent") {
      list.sort(function (a, b) {
        var ra = recentIndex(songSlug(a));
        var rb = recentIndex(songSlug(b));
        if (ra !== rb) return ra - rb;
        return compareArtist(a, b);
      });
      list = list.filter(function (s) {
        return recentIndex(songSlug(s)) < 9999;
      });
    } else {
      list.sort(compareArtist);
    }
    state.order = list.map(songSlug);
    return list;
  }

  function groupKey(song) {
    if (state.sort === "title") {
      var ch = String(song.title || "?").charAt(0).toUpperCase();
      return /[A-Z]/.test(ch) ? ch : "#";
    }
    if (state.sort === "tuning") return tuningLabel(song);
    if (state.sort === "capo") {
      var c = capoOf(song);
      if (c == null || c === 0) return "No capo";
      return "Capo " + c;
    }
    if (state.sort === "recent") return "Recently viewed";
    return song.artist || "Other";
  }

  function groupSongs(list) {
    var groups = [];
    var map = Object.create(null);
    list.forEach(function (song) {
      var key = groupKey(song);
      if (!map[key]) {
        map[key] = { key: key, songs: [] };
        groups.push(map[key]);
      }
      map[key].songs.push(song);
    });
    return groups;
  }

  function railKeys(groups) {
    if (state.sort === "title") {
      return groups.map(function (g) {
        return g.key;
      });
    }
    if (state.sort === "artist") {
      return groups.map(function (g) {
        var ch = String(g.key || "?").charAt(0).toUpperCase();
        return /[A-Z]/.test(ch) ? ch : "#";
      }).filter(function (v, i, arr) {
        return arr.indexOf(v) === i;
      });
    }
    return groups.map(function (g, i) {
      return String(i + 1);
    });
  }

  function applyStageClass() {
    document.body.classList.toggle("lb-stage", !!state.stage);
  }

  function applySongOpenClass(open) {
    document.body.classList.toggle("lb-song-open", !!open);
  }

  function currentTextSize() {
    if (api && typeof api.getTextSize === "function") return api.getTextSize();
    return "md";
  }

  function setTextSize(size) {
    if (TEXT_SIZES.indexOf(size) === -1) size = "md";
    if (api && typeof api.setTextSize === "function") api.setTextSize(size);
    if (els.fontLabel) els.fontLabel.textContent = size.toUpperCase();
  }

  function bumpTextSize(delta) {
    var cur = currentTextSize();
    var i = TEXT_SIZES.indexOf(cur);
    if (i < 0) i = 1;
    var next = TEXT_SIZES[Math.min(TEXT_SIZES.length - 1, Math.max(0, i + delta))];
    setTextSize(next);
  }

  function rememberRecent(slug) {
    if (!slug) return;
    state.recent = [slug].concat(
      state.recent.filter(function (s) {
        return s !== slug;
      })
    ).slice(0, 40);
    storageSetJson(RECENT_KEY, state.recent);
  }

  function isPinned(slug) {
    return state.setlist.indexOf(slug) !== -1;
  }

  function togglePin(slug) {
    if (!slug) return;
    if (isPinned(slug)) {
      state.setlist = state.setlist.filter(function (s) {
        return s !== slug;
      });
    } else {
      state.setlist = state.setlist.concat([slug]).slice(0, 40);
    }
    storageSetJson(SETLIST_KEY, state.setlist);
    renderBrowse();
    if (state.currentSlug) renderSongView(state.currentSlug);
  }

  function findInOrder(slug) {
    return state.order.indexOf(slug);
  }

  function neighborSlug(slug, delta) {
    var i = findInOrder(slug);
    if (i < 0) return null;
    var next = i + delta;
    if (next < 0 || next >= state.order.length) return null;
    return state.order[next];
  }

  async function requestWakeLock() {
    if (!("wakeLock" in navigator) || !navigator.wakeLock) return;
    try {
      if (state.wakeLock) {
        try {
          await state.wakeLock.release();
        } catch (e) {
          /* ignore */
        }
        state.wakeLock = null;
      }
      state.wakeLock = await navigator.wakeLock.request("screen");
      state.wakeLock.addEventListener("release", function () {
        state.wakeLock = null;
      });
    } catch (e) {
      state.wakeLock = null;
    }
  }

  async function releaseWakeLock() {
    if (!state.wakeLock) return;
    try {
      await state.wakeLock.release();
    } catch (e) {
      /* ignore */
    }
    state.wakeLock = null;
  }

  function stopAutoScroll() {
    state.autoScroll = false;
    if (scrollTimer) {
      clearInterval(scrollTimer);
      scrollTimer = null;
    }
    if (els.scrollBtn) {
      els.scrollBtn.setAttribute("aria-pressed", "false");
      els.scrollBtn.textContent = "Auto-scroll";
    }
  }

  function startAutoScroll() {
    stopAutoScroll();
    state.autoScroll = true;
    if (els.scrollBtn) {
      els.scrollBtn.setAttribute("aria-pressed", "true");
      els.scrollBtn.textContent = "Stop scroll";
    }
    scrollTimer = setInterval(function () {
      if (!state.autoScroll) return;
      var step = Math.max(1, Math.round(state.scrollSpeed / 20));
      window.scrollBy(0, step);
      var max =
        document.documentElement.scrollHeight - window.innerHeight - 8;
      if (window.scrollY >= max) stopAutoScroll();
    }, 50);
  }

  function attributionHtml(song) {
    var source = String((song && song.source) || "missing").toLowerCase();
    if (source === "docs") {
      return '<p class="lb-attrib">From my lyric docs</p>';
    }
    if (song && song.lyrics_copyright) {
      return (
        '<p class="lb-attrib">' + escapeHtml(song.lyrics_copyright) + "</p>"
      );
    }
    if (source === "missing") {
      return '<p class="lb-attrib">No lyrics (instrumental or unavailable)</p>';
    }
    return "";
  }

  function lyricsBodyHtml(song) {
    if (!song || song.lyrics == null || song.lyrics === "") {
      return '<p class="lb-empty">No lyrics available for this song.</p>';
    }
    return (
      '<pre class="lb-lyrics">' + escapeHtml(song.lyrics) + "</pre>"
    );
  }

  function updatePrefetchUi() {
    if (!els.prefetch) return;
    els.prefetch.hidden = false;
    els.prefetch.setAttribute("data-state", state.prefetch.state);
    if (state.prefetch.state === "loading") {
      els.prefetchText.textContent =
        "Caching songs offline… " +
        state.prefetch.done +
        "/" +
        state.prefetch.total;
    } else if (state.prefetch.state === "ready") {
      els.prefetchText.textContent =
        "All " + state.prefetch.total + " songs ready offline";
    } else if (state.prefetch.state === "error") {
      els.prefetchText.textContent =
        "Offline cache partial (" +
        state.prefetch.done +
        "/" +
        state.prefetch.total +
        ")";
    } else {
      els.prefetch.hidden = true;
    }
  }

  async function mapPool(items, limit, worker, onProgress) {
    var i = 0;
    var done = 0;
    var results = new Array(items.length);
    async function run() {
      while (i < items.length) {
        if (state.prefetchAbort) return;
        var idx = i++;
        results[idx] = await worker(items[idx], idx);
        done++;
        if (onProgress) onProgress(done, items.length);
      }
    }
    var n = Math.min(limit, Math.max(1, items.length));
    var runners = [];
    for (var r = 0; r < n; r++) runners.push(run());
    await Promise.all(runners);
    return results;
  }

  function startPrefetch() {
    if (!api || typeof api.loadSongDetails !== "function") return;
    var list = songs();
    state.prefetchAbort = false;
    state.prefetch = {
      done: 0,
      total: list.length,
      state: list.length ? "loading" : "ready",
      error: "",
    };
    updatePrefetchUi();
    if (!list.length) return;

    mapPool(
      list,
      PREFETCH_CONCURRENCY,
      function (meta) {
        return api.loadSongDetails(meta).catch(function () {
          return null;
        });
      },
      function (done, total) {
        state.prefetch.done = done;
        state.prefetch.total = total;
        updatePrefetchUi();
      }
    )
      .then(function (results) {
        if (state.prefetchAbort) return;
        var ok = results.filter(Boolean).length;
        state.prefetch.done = ok;
        state.prefetch.state = ok === list.length ? "ready" : "error";
        updatePrefetchUi();
      })
      .catch(function () {
        state.prefetch.state = "error";
        updatePrefetchUi();
      });
  }

  function shellHtml() {
    return (
      '<div class="lb-browse">' +
      '<div class="lb-chrome">' +
      '<div class="lb-bar lb-bar--compact">' +
      '<div class="lb-bar__grow">' +
      '<label class="visually-hidden" for="lb-search">Search songs</label>' +
      '<input id="lb-search" class="lb-search" type="search" placeholder="Search title or artist" enterkeyhint="search" autocomplete="off">' +
      "</div>" +
      '<button type="button" class="lb-btn lb-btn--secondary" id="lb-filters-toggle" aria-expanded="false" aria-controls="lb-filters-panel">Filters</button>' +
      '<label class="visually-hidden" for="lb-sort">Sort songs</label>' +
      '<select id="lb-sort" class="lb-select lb-select--sort">' +
      '<option value="artist">Artist</option>' +
      '<option value="title">Title</option>' +
      '<option value="tuning">Tuning</option>' +
      '<option value="capo">Capo</option>' +
      '<option value="recent">Recent</option>' +
      "</select>" +
      '<div class="lb-overflow">' +
      '<button type="button" class="lb-btn lb-btn--ghost" id="lb-settings-btn" aria-expanded="false" aria-haspopup="true" aria-controls="lb-settings-menu" title="Settings" aria-label="Settings">⋯</button>' +
      '<div class="lb-menu" id="lb-settings-menu" role="menu" hidden>' +
      '<div class="lb-menu__section" role="none">' +
      '<p class="lb-menu__label">Text size</p>' +
      '<div class="lb-menu__row" role="none">' +
      '<button type="button" class="lb-btn lb-btn--ghost" id="lb-menu-font-down" aria-label="Smaller text">A−</button>' +
      '<span class="lb-menu__value" id="lb-font-label">MD</span>' +
      '<button type="button" class="lb-btn lb-btn--ghost" id="lb-menu-font-up" aria-label="Larger text">A+</button>' +
      "</div></div>" +
      '<div class="lb-menu__section" role="none">' +
      '<button type="button" class="lb-menu__item" id="lb-stage-toggle" role="menuitemcheckbox" aria-checked="false">Stage mode</button>' +
      "</div>" +
      '<div class="lb-menu__section" role="none">' +
      '<p class="lb-menu__label">Layout</p>' +
      '<div class="lb-menu__row lb-menu__row--seg" role="group" aria-label="Layout mode">' +
      '<button type="button" class="lb-btn lb-btn--ghost" data-layout-mode="auto" aria-pressed="true">Auto</button>' +
      '<button type="button" class="lb-btn lb-btn--ghost" data-layout-mode="desktop" aria-pressed="false">Desktop</button>' +
      '<button type="button" class="lb-btn lb-btn--ghost" data-layout-mode="touch" aria-pressed="false">Touch</button>' +
      "</div></div>" +
      '<div class="lb-menu__section" role="none">' +
      '<p class="lb-menu__label">Notes</p>' +
      '<button type="button" class="lb-menu__item" id="lb-notes-export" role="menuitem">Export notes</button>' +
      '<button type="button" class="lb-menu__item" id="lb-notes-copy" role="menuitem">Copy notes</button>' +
      '<button type="button" class="lb-menu__item" id="lb-notes-share" role="menuitem" hidden>Share notes</button>' +
      '<label class="lb-menu__item lb-file-btn" for="lb-notes-import" role="menuitem">Import notes<input id="lb-notes-import" type="file" accept="application/json,.json" hidden></label>' +
      "</div>" +
      '<div class="lb-menu__section" role="none">' +
      '<button type="button" class="lb-menu__item" id="lb-sync-gear" role="menuitem" aria-expanded="false">Note sync…</button>' +
      '<button type="button" class="lb-menu__item" id="lb-menu-print" role="menuitem">Print song</button>' +
      '<button type="button" class="lb-menu__item" id="lb-menu-songbook" role="menuitem">Download songbook PDF</button>' +
      "</div>" +
      "</div></div>" +
      '<button type="button" class="lb-btn lb-btn--ghost" id="lb-lock">Lock</button>' +
      "</div>" +
      '<div class="lb-filters-panel" id="lb-filters-panel" hidden>' +
      '<div class="lb-filters" id="lb-filters"></div>' +
      "</div>" +
      '<div class="lb-sync-panel" id="lb-sync-panel" hidden>' +
      '<h3 class="lb-sync-panel__title">Note sync</h3>' +
      '<p class="lb-status">Optional webhook for live note backup. Stored only on this device.</p>' +
      '<label class="lb-sync-field">Webhook URL' +
      '<input id="lb-sync-url" type="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://…">' +
      '<span class="lb-field-error" id="lb-sync-url-err" hidden></span></label>' +
      '<label class="lb-sync-field">Sender key' +
      '<input id="lb-sync-key" type="password" autocomplete="off" spellcheck="false">' +
      '<span class="lb-field-error" id="lb-sync-key-err" hidden></span></label>' +
      '<label class="lb-sync-field">Key header name' +
      '<input id="lb-sync-header" type="text" autocomplete="off" spellcheck="false" placeholder="Authorization">' +
      '<span class="lb-field-error" id="lb-sync-header-err" hidden></span></label>' +
      '<div class="lb-bar lb-bar--sync">' +
      '<button type="button" class="lb-btn" id="lb-sync-save">Save settings</button>' +
      '<button type="button" class="lb-btn lb-btn--secondary" id="lb-sync-test">Send test</button>' +
      '<button type="button" class="lb-btn lb-btn--ghost" id="lb-sync-flush">Retry queue</button>' +
      "</div>" +
      '<p class="lb-status" id="lb-sync-msg" hidden aria-live="polite"></p>' +
      "</div>" +
      '<p class="lb-status" id="lb-notes-msg" hidden aria-live="polite"></p>' +
      '<div class="lb-prefetch" id="lb-prefetch" hidden data-state="idle">' +
      '<span class="lb-prefetch__dot" aria-hidden="true"></span>' +
      '<span id="lb-prefetch-text"></span>' +
      "</div>" +
      '<p class="lb-status" id="lb-status" aria-live="polite"></p>' +
      "</div>" +
      '<div class="lb-layout">' +
      '<div class="lb-list-wrap" id="lb-list"></div>' +
      '<nav class="lb-rail" id="lb-rail" aria-label="Jump to section"></nav>' +
      "</div>" +
      '<section class="lb-setlist" id="lb-setlist" aria-label="Setlist queue"></section>' +
      "</div>" +
      '<div class="lb-stage-view lb-hidden" id="lb-song" hidden></div>'
    );
  }

  function songsForInstrument() {
    return songs().filter(function (s) {
      return songHasInstrument(s, activeInstrumentName());
    });
  }

  function renderFilters() {
    if (!els.filters) return;
    var pool = songsForInstrument();
    var tunings = uniqueSorted(
      pool.map(function (s) {
        return tuningLabel(s);
      })
    );
    var capos = uniqueSorted(
      pool
        .map(function (s) {
          var c = capoOf(s);
          if (c == null || c === 0) return null;
          return String(c);
        })
        .filter(Boolean)
    );
    var artists = uniqueSorted(
      pool.map(function (s) {
        return s.artist;
      })
    );

    var html = "";
    html += '<div class="lb-filter-row">';
    html += '<span class="lb-filter-label">Instrument</span>';
    INSTRUMENTS.forEach(function (name) {
      html +=
        '<button type="button" class="lb-chip" data-instrument="' +
        escapeHtml(name) +
        '" aria-pressed="' +
        (state.instrumentFilter === name ? "true" : "false") +
        '">' +
        escapeHtml(name) +
        "</button>";
    });
    html += "</div>";

    html += '<div class="lb-filter-row">';
    html += '<span class="lb-filter-label">Tuning</span>';
    html +=
      '<button type="button" class="lb-chip" data-tuning="all" aria-pressed="' +
      (state.tuningFilter === "all" ? "true" : "false") +
      '">All</button>';
    tunings.forEach(function (t) {
      var anyUnverified =
        t !== "Unspecified" &&
        pool.some(function (s) {
          return tuningLabel(s) === t && tuningUnverified(s);
        });
      var allUnverified =
        anyUnverified &&
        pool
          .filter(function (s) {
            return tuningLabel(s) === t;
          })
          .every(function (s) {
            return tuningUnverified(s);
          });
      html +=
        '<button type="button" class="lb-chip" data-tuning="' +
        escapeHtml(t) +
        '" aria-pressed="' +
        (state.tuningFilter === t ? "true" : "false") +
        '">' +
        escapeHtml(t) +
        (allUnverified
          ? '<span class="lb-unverified" title="Tuning not verified">?</span>'
          : "") +
        "</button>";
    });
    html += "</div>";

    html += '<div class="lb-filter-row">';
    html += '<span class="lb-filter-label">Capo</span>';
    html +=
      '<button type="button" class="lb-chip" data-capo="all" aria-pressed="' +
      (state.capoFilter === "all" ? "true" : "false") +
      '">All</button>';
    html +=
      '<button type="button" class="lb-chip" data-capo="none" aria-pressed="' +
      (state.capoFilter === "none" ? "true" : "false") +
      '">None</button>';
    capos.forEach(function (c) {
      html +=
        '<button type="button" class="lb-chip" data-capo="' +
        escapeHtml(c) +
        '" aria-pressed="' +
        (state.capoFilter === c ? "true" : "false") +
        '">Capo ' +
        escapeHtml(c) +
        "</button>";
    });
    html += "</div>";

    html += '<div class="lb-filter-row">';
    html += '<label class="lb-filter-label" for="lb-artist">Artist</label>';
    html += '<select class="lb-select" id="lb-artist">';
    html += '<option value="all">All artists</option>';
    artists.forEach(function (a) {
      html +=
        '<option value="' +
        escapeHtml(a) +
        '"' +
        (state.artistFilter === a ? " selected" : "") +
        ">" +
        escapeHtml(a) +
        "</option>";
    });
    html += "</select></div>";

    els.filters.innerHTML = html;
  }

  function renderSetlist() {
    if (!els.setlist) return;
    var items = state.setlist
      .map(function (slug) {
        return songs().filter(function (s) {
          return songSlug(s) === slug;
        })[0];
      })
      .filter(Boolean);

    var html =
      '<h2 class="lb-setlist__title">Setlist queue</h2>';
    if (!items.length) {
      html +=
        '<p class="lb-setlist__empty">Pin songs while browsing to build a quick set.</p>';
    } else {
      items.forEach(function (song) {
        var slug = songSlug(song);
        html +=
          '<div class="lb-setlist__item">' +
          '<button type="button" class="lb-btn lb-btn--ghost" data-open-slug="' +
          escapeHtml(slug) +
          '">' +
          escapeHtml(song.title) +
          " — " +
          escapeHtml(song.artist) +
          "</button>" +
          '<button type="button" class="lb-pin" data-unpin="' +
          escapeHtml(slug) +
          '" aria-label="Remove from setlist">Remove</button>' +
          "</div>";
      });
      html +=
        '<p class="lb-bar" style="margin-top:0.75rem"><button type="button" class="lb-btn lb-btn--ghost" id="lb-clear-setlist">Clear setlist</button></p>';
    }
    els.setlist.innerHTML = html;
  }

  function renderBrowse() {
    if (!els.list) return;
    var list = sortedSongs();
    var groups = groupSongs(list);

    if (els.status) {
      els.status.textContent = list.length
        ? list.length + " song" + (list.length === 1 ? "" : "s")
        : state.sort === "recent"
          ? "No recently viewed songs yet"
          : "No songs match these filters";
    }

    if (els.sortSelect) {
      els.sortSelect.value = state.sort;
    }

    if (els.stageToggle) {
      els.stageToggle.setAttribute(
        "aria-checked",
        state.stage ? "true" : "false"
      );
      els.stageToggle.textContent = state.stage ? "Stage on" : "Stage mode";
    }

    updateFiltersToggle();
    syncLayoutMenu();
    if (els.fontLabel) {
      els.fontLabel.textContent = currentTextSize().toUpperCase();
    }

    renderFilters();

    if (!list.length) {
      els.list.innerHTML = '<p class="lb-empty">Nothing to show.</p>';
      if (els.rail) els.rail.innerHTML = "";
      renderSetlist();
      return;
    }

    var html = "";
    groups.forEach(function (group, gi) {
      var id = "lb-group-" + gi;
      html +=
        '<section class="lb-group" id="' +
        id +
        '" data-rail="' +
        escapeHtml(
          state.sort === "artist"
            ? String(group.key || "?").charAt(0).toUpperCase()
            : state.sort === "title"
              ? group.key
              : String(gi + 1)
        ) +
        '">';
      var headMark = "";
      if (
        state.sort === "tuning" &&
        group.key !== "Unspecified" &&
        group.songs.length &&
        group.songs.every(tuningUnverified)
      ) {
        headMark =
          '<span class="lb-unverified" title="Tuning not verified">?</span>';
      }
      html +=
        '<h3 class="lb-group__head">' +
        escapeHtml(group.key) +
        headMark +
        "</h3>";
      group.songs.forEach(function (song) {
        var slug = songSlug(song);
        var setup = formatSetup(song);
        var noted = songHasNotes(slug);
        html +=
          '<div class="lb-row" style="display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:0.35rem;align-items:stretch">';
        html +=
          '<button type="button" class="lb-song" data-open-slug="' +
          escapeHtml(slug) +
          '">' +
          '<span class="lb-song__title">' +
          escapeHtml(song.title) +
          (noted
            ? '<span class="lb-note-dot" title="Has notes" aria-label="Has notes"></span>'
            : "") +
          "</span>" +
          '<span class="lb-song__meta">' +
          escapeHtml(song.artist) +
          "</span>";
        if (setup) {
          html +=
            '<span class="lb-song__setup">' + escapeHtml(setup) + "</span>";
        }
        html += "</button>";
        html +=
          '<button type="button" class="lb-pin" data-open-notes="' +
          escapeHtml(slug) +
          '" aria-label="Edit notes">Notes</button>';
        html +=
          '<button type="button" class="lb-pin" data-pin="' +
          escapeHtml(slug) +
          '" aria-pressed="' +
          (isPinned(slug) ? "true" : "false") +
          '" aria-label="' +
          (isPinned(slug) ? "Unpin from setlist" : "Pin to setlist") +
          '">' +
          (isPinned(slug) ? "Pinned" : "Pin") +
          "</button></div>";
      });
      html += "</section>";
    });
    els.list.innerHTML = html;

    if (els.rail) {
      var keys = railKeys(groups);
      els.rail.innerHTML = keys
        .map(function (k) {
          return (
            '<button type="button" class="lb-rail__btn" data-jump="' +
            escapeHtml(k) +
            '">' +
            escapeHtml(k) +
            "</button>"
          );
        })
        .join("");
    }

    renderSetlist();
  }

  function closeSongView() {
    stopAutoScroll();
    releaseWakeLock();
    state.currentSlug = null;
    applySongOpenClass(false);
    if (els.song) {
      els.song.hidden = true;
      els.song.classList.add("lb-hidden");
      els.song.innerHTML = "";
    }
    if (els.browse) els.browse.classList.remove("lb-hidden");
    if (api && typeof api.clearSongHash === "function") api.clearSongHash();
    else if (window.location.hash) {
      history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search
      );
    }
    renderBrowse();
  }

  function bindSongGestures() {
    if (!els.song) return;
    els.song.addEventListener(
      "touchstart",
      function (e) {
        if (!e.changedTouches || !e.changedTouches[0]) return;
        state.swipeStartX = e.changedTouches[0].clientX;
        state.swipeStartY = e.changedTouches[0].clientY;
      },
      { passive: true }
    );
    els.song.addEventListener(
      "touchend",
      function (e) {
        if (!e.changedTouches || !e.changedTouches[0]) return;
        var dx = e.changedTouches[0].clientX - state.swipeStartX;
        var dy = e.changedTouches[0].clientY - state.swipeStartY;
        if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
        if (dx < 0) openSongBySlug(neighborSlug(state.currentSlug, 1), true);
        else openSongBySlug(neighborSlug(state.currentSlug, -1), true);
      },
      { passive: true }
    );
  }

  function syncStatusLabel(slug) {
    var N = notesApi();
    if (!N) return "";
    var st = N.getStatus(slug) || {};
    if (st.status === "synced") return "Synced";
    if (st.status === "offline") return "Offline — queued";
    if (st.status === "cors") return st.detail || "CORS blocked — use Export";
    if (st.status === "error" || st.status === "pending") {
      return st.detail || (st.status === "pending" ? "Syncing…" : "Not synced");
    }
    if (st.status === "off") return "";
    return "";
  }

  function bindNotesEditor(meta, details) {
    var N = notesApi();
    var ta = $("#lb-notes-ta", els.song);
    var statusEl = $("#lb-notes-sync-status", els.song);
    if (!N || !ta) return;
    var slug = songSlug(meta);
    var title = (details && details.title) || meta.title;
    var artist = (details && details.artist) || meta.artist;
    var songMeta = Object.assign({}, metaForSong(meta), {
      title: title,
      artist: artist,
      instruments: instrumentsOf(meta),
    });

    function refreshStatus() {
      if (!statusEl) return;
      var label = syncStatusLabel(slug);
      statusEl.textContent = label || "Notes stay on this device";
      statusEl.className =
        "lb-notes-sync" +
        (label.indexOf("Not synced") !== -1 || label.indexOf("CORS") !== -1
          ? " lb-notes-sync--warn"
          : label === "Synced"
            ? " lb-notes-sync--ok"
            : "");
      statusEl.setAttribute(
        "data-retry",
        label.indexOf("Not synced") !== -1 || label.indexOf("Offline") !== -1
          ? "1"
          : "0"
      );
    }

    function persist(immediate) {
      N.saveNoteAndSync(
        slug,
        { title: title, artist: artist, notes: ta.value },
        songMeta,
        { immediate: !!immediate }
      ).then(refreshStatus);
      refreshStatus();
    }

    ta.addEventListener("input", function () {
      persist(false);
    });
    ta.addEventListener("blur", function () {
      persist(true);
    });
    if (statusEl) {
      statusEl.addEventListener("click", function () {
        if (statusEl.getAttribute("data-retry") === "1") {
          N.syncNow(slug, songMeta, N.getNote(slug)).then(refreshStatus);
        }
      });
    }
    refreshStatus();
  }

  function renderSongChrome(meta, details, opts) {
    opts = opts || {};
    var slug = songSlug(meta);
    var prev = neighborSlug(slug, -1);
    var next = neighborSlug(slug, 1);
    var setupLine = formatSetup(meta);
    var N = notesApi();
    var noteEntry = N ? N.getNote(slug) : null;
    var noteText = noteEntry ? noteEntry.notes || "" : "";

    var body = details
      ? lyricsBodyHtml(details) + attributionHtml(details)
      : '<p class="lb-status">Loading lyrics…</p>';

    els.song.innerHTML =
      '<div class="lb-stage-view__top">' +
      '<button type="button" class="lb-btn lb-btn--secondary" id="lb-back">Back</button>' +
      '<div class="lb-dock__cluster">' +
      '<button type="button" class="lb-btn lb-btn--ghost" id="lb-font-down" aria-label="Smaller text">A−</button>' +
      '<span class="lb-status" id="lb-font-label" style="margin:0">' +
      currentTextSize().toUpperCase() +
      "</span>" +
      '<button type="button" class="lb-btn lb-btn--ghost" id="lb-font-up" aria-label="Larger text">A+</button>' +
      "</div>" +
      '<button type="button" class="lb-btn lb-btn--secondary" id="lb-song-stage" aria-pressed="' +
      (state.stage ? "true" : "false") +
      '">' +
      (state.stage ? "Stage on" : "Stage") +
      "</button>" +
      '<button type="button" class="lb-pin" id="lb-song-pin" aria-pressed="' +
      (isPinned(slug) ? "true" : "false") +
      '">' +
      (isPinned(slug) ? "Pinned" : "Pin") +
      "</button>" +
      '<h2 class="lb-stage-view__title">' +
      escapeHtml((details && details.title) || meta.title) +
      "</h2>" +
      '<p class="lb-stage-view__artist">' +
      escapeHtml((details && details.artist) || meta.artist) +
      "</p>" +
      (setupLine
        ? '<p class="lb-setup-banner"><span class="lb-setup-pill song-setup">' +
          escapeHtml(setupLine) +
          "</span></p>"
        : "") +
      "</div>" +
      '<div id="lb-song-body">' +
      body +
      "</div>" +
      '<section class="lb-notes" aria-label="Song notes">' +
      '<div class="lb-notes__head"><h3 class="lb-notes__title">Notes</h3>' +
      '<button type="button" class="lb-notes-sync" id="lb-notes-sync-status">Notes stay on this device</button></div>' +
      '<label class="visually-hidden" for="lb-notes-ta">Notes</label>' +
      '<textarea id="lb-notes-ta" class="lb-notes__ta" rows="5" placeholder="Personal notes for this song…">' +
      escapeHtml(noteText) +
      "</textarea>" +
      "</section>" +
      '<div class="lb-dock">' +
      '<div class="lb-dock__row lb-dock__row--nav">' +
      '<button type="button" class="lb-btn lb-btn--secondary lb-btn--flex" id="lb-prev" ' +
      (prev ? "" : "disabled ") +
      ">Prev</button>" +
      '<button type="button" class="lb-btn lb-btn--flex" id="lb-next" ' +
      (next ? "" : "disabled ") +
      ">Next</button>" +
      "</div>" +
      '<div class="lb-dock__row lb-dock__row--scroll">' +
      '<button type="button" class="lb-btn lb-btn--ghost" id="lb-autoscroll" aria-pressed="false">Auto-scroll</button>' +
      '<label class="lb-speed">Speed <input id="lb-speed" type="range" min="8" max="120" value="' +
      state.scrollSpeed +
      '"></label>' +
      "</div></div>";

    els.fontLabel = $("#lb-font-label", els.song);
    els.scrollBtn = $("#lb-autoscroll", els.song);

    $("#lb-back", els.song).addEventListener("click", function () {
      var ta = $("#lb-notes-ta", els.song);
      if (ta && N) {
        N.saveNoteAndSync(
          slug,
          {
            title: (details && details.title) || meta.title,
            artist: (details && details.artist) || meta.artist,
            notes: ta.value,
          },
          Object.assign({}, metaForSong(meta), {
            instruments: instrumentsOf(meta),
          }),
          { immediate: true }
        );
      }
      closeSongView();
    });
    $("#lb-font-down", els.song).addEventListener("click", function () {
      bumpTextSize(-1);
    });
    $("#lb-font-up", els.song).addEventListener("click", function () {
      bumpTextSize(1);
    });
    $("#lb-song-stage", els.song).addEventListener("click", function () {
      state.stage = !state.stage;
      storageSet(STAGE_KEY, state.stage ? "1" : "0");
      applyStageClass();
      renderSongChrome(meta, details, opts);
    });
    $("#lb-song-pin", els.song).addEventListener("click", function () {
      togglePin(slug);
    });
    $("#lb-prev", els.song).addEventListener("click", function () {
      openSongBySlug(prev, true);
    });
    $("#lb-next", els.song).addEventListener("click", function () {
      openSongBySlug(next, true);
    });
    $("#lb-autoscroll", els.song).addEventListener("click", function () {
      if (state.autoScroll) stopAutoScroll();
      else startAutoScroll();
    });
    $("#lb-speed", els.song).addEventListener("input", function (e) {
      state.scrollSpeed = Number(e.target.value) || 35;
      storageSet(SPEED_KEY, String(state.scrollSpeed));
      if (state.autoScroll) startAutoScroll();
    });
    bindNotesEditor(meta, details);
    if (opts.focusNotes) {
      var taFocus = $("#lb-notes-ta", els.song);
      if (taFocus) {
        setTimeout(function () {
          taFocus.focus();
          taFocus.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 50);
      }
    }
  }

  function openSongBySlug(slug, updateHash, opts) {
    opts = opts || {};
    if (!slug || !api) return;
    var meta =
      typeof api.findSongBySlug === "function"
        ? api.findSongBySlug(slug)
        : songs().filter(function (s) {
            return songSlug(s) === slug;
          })[0];
    if (!meta) return;

    sortedSongs();
    rememberRecent(slug);
    state.currentSlug = slug;
    stopAutoScroll();
    applySongOpenClass(true);
    applySongPaneVisibility();
    els.song.hidden = false;
    els.song.classList.remove("lb-hidden");
    renderSongChrome(meta, null, opts);
    requestWakeLock();
    if (updateHash && typeof api.setHashForSong === "function") {
      api.setHashForSong(meta);
    }
    window.scrollTo(0, 0);

    api
      .loadSongDetails(meta)
      .then(function (details) {
        if (state.currentSlug !== slug) return;
        renderSongChrome(meta, details, opts);
      })
      .catch(function (err) {
        if (state.currentSlug !== slug) return;
        var body = $("#lb-song-body", els.song);
        if (body) {
          body.innerHTML =
            '<p class="lb-status lb-status--error">' +
            escapeHtml((err && err.message) || "Could not load lyrics.") +
            "</p>";
        }
      });
  }

  function onRootClick(e) {
    var t = e.target.closest("[data-layout-mode]");
    if (t) {
      setLayoutMode(t.getAttribute("data-layout-mode"));
      return;
    }
    t = e.target.closest("[data-instrument]");
    if (t) {
      state.instrumentFilter = t.getAttribute("data-instrument");
      storageSet(INSTRUMENT_KEY, state.instrumentFilter);
      state.tuningFilter = "all";
      state.capoFilter = "all";
      renderBrowse();
      return;
    }
    t = e.target.closest("[data-tuning]");
    if (t) {
      state.tuningFilter = t.getAttribute("data-tuning");
      renderBrowse();
      return;
    }
    t = e.target.closest("[data-capo]");
    if (t) {
      state.capoFilter = t.getAttribute("data-capo");
      renderBrowse();
      return;
    }
    t = e.target.closest("[data-open-notes]");
    if (t) {
      openSongBySlug(t.getAttribute("data-open-notes"), true, {
        focusNotes: true,
      });
      return;
    }
    t = e.target.closest("[data-open-slug]");
    if (t) {
      openSongBySlug(t.getAttribute("data-open-slug"), true);
      return;
    }
    t = e.target.closest("[data-pin]");
    if (t) {
      togglePin(t.getAttribute("data-pin"));
      return;
    }
    t = e.target.closest("[data-unpin]");
    if (t) {
      togglePin(t.getAttribute("data-unpin"));
      return;
    }
    t = e.target.closest("[data-jump]");
    if (t) {
      var key = t.getAttribute("data-jump");
      var section = root.querySelector('.lb-group[data-rail="' + key + '"]');
      if (!section) {
        section = Array.prototype.find.call(
          root.querySelectorAll(".lb-group"),
          function (g) {
            return g.getAttribute("data-rail") === key;
          }
        );
      }
      if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (e.target.id === "lb-clear-setlist") {
      state.setlist = [];
      storageSetJson(SETLIST_KEY, state.setlist);
      renderBrowse();
    }
  }

  function clearSyncFieldErrors() {
    ["url", "key", "header"].forEach(function (name) {
      var err = $("#lb-sync-" + name + "-err", root);
      var input = $("#lb-sync-" + name, root);
      if (err) {
        err.textContent = "";
        err.hidden = true;
      }
      if (input) input.removeAttribute("aria-invalid");
    });
  }

  function showSyncFieldErrors(errors) {
    clearSyncFieldErrors();
    errors = errors || {};
    var map = {
      url: errors.url,
      header: errors.header,
      key: errors.key,
    };
    Object.keys(map).forEach(function (name) {
      var msg = map[name];
      if (!msg) return;
      var err = $("#lb-sync-" + name + "-err", root);
      var input = $("#lb-sync-" + name, root);
      if (err) {
        err.textContent = msg;
        err.hidden = false;
      }
      if (input) input.setAttribute("aria-invalid", "true");
    });
  }

  function fillSyncForm(settings) {
    var url = $("#lb-sync-url", root);
    var key = $("#lb-sync-key", root);
    var header = $("#lb-sync-header", root);
    if (url) url.value = (settings && settings.url) || "";
    if (key) key.value = (settings && settings.key) || "";
    if (header) header.value = (settings && settings.header) || "Authorization";
  }

  function readSyncForm() {
    return {
      url: ($("#lb-sync-url", root) || {}).value || "",
      key: ($("#lb-sync-key", root) || {}).value || "",
      header: ($("#lb-sync-header", root) || {}).value || "",
    };
  }

  function setSyncMsg(text, kind) {
    if (!els.syncMsg) return;
    els.syncMsg.textContent = text || "";
    els.syncMsg.hidden = !text;
    els.syncMsg.className =
      "lb-status" + (kind ? " lb-status--" + kind : "");
  }

  function closeSettingsMenu() {
    if (els.settingsMenu) els.settingsMenu.hidden = true;
    if (els.settingsBtn) {
      els.settingsBtn.setAttribute("aria-expanded", "false");
    }
  }

  function bindShell() {
    root.addEventListener("click", onRootClick);
    els.search = $("#lb-search", root);
    els.filters = $("#lb-filters", root);
    els.filtersPanel = $("#lb-filters-panel", root);
    els.filtersToggle = $("#lb-filters-toggle", root);
    els.sortSelect = $("#lb-sort", root);
    els.prefetch = $("#lb-prefetch", root);
    els.prefetchText = $("#lb-prefetch-text", root);
    els.status = $("#lb-status", root);
    els.list = $("#lb-list", root);
    els.rail = $("#lb-rail", root);
    els.setlist = $("#lb-setlist", root);
    els.browse = $(".lb-browse", root);
    els.song = $("#lb-song", root);
    els.stageToggle = $("#lb-stage-toggle", root);
    els.lockBtn = $("#lb-lock", root);
    els.notesMsg = $("#lb-notes-msg", root);
    els.syncPanel = $("#lb-sync-panel", root);
    els.syncMsg = $("#lb-sync-msg", root);
    els.settingsBtn = $("#lb-settings-btn", root);
    els.settingsMenu = $("#lb-settings-menu", root);
    els.fontLabel = $("#lb-font-label", root);

    function setNotesMsg(text, kind) {
      if (!els.notesMsg) return;
      els.notesMsg.textContent = text || "";
      els.notesMsg.hidden = !text;
      els.notesMsg.className =
        "lb-status" + (kind ? " lb-status--" + kind : "");
    }

    if (els.search) {
      els.search.value = state.query;
      els.search.addEventListener("input", function () {
        state.query = els.search.value;
        renderBrowse();
      });
    }

    if (els.sortSelect) {
      els.sortSelect.value = state.sort;
      els.sortSelect.addEventListener("change", function () {
        state.sort = els.sortSelect.value || "artist";
        storageSet(SORT_KEY, state.sort);
        renderBrowse();
      });
    }

    if (els.filtersToggle) {
      els.filtersToggle.addEventListener("click", function () {
        setFiltersOpen(!state.filtersOpen);
      });
    }

    if (els.settingsBtn && els.settingsMenu) {
      els.settingsBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        var open = els.settingsMenu.hidden;
        els.settingsMenu.hidden = !open;
        els.settingsBtn.setAttribute("aria-expanded", open ? "true" : "false");
      });
      document.addEventListener("click", function (e) {
        if (!els.settingsMenu || els.settingsMenu.hidden) return;
        if (els.settingsMenu.contains(e.target)) return;
        if (els.settingsBtn && els.settingsBtn.contains(e.target)) return;
        closeSettingsMenu();
      });
    }

    root.addEventListener("change", function (e) {
      if (e.target && e.target.id === "lb-artist") {
        state.artistFilter = e.target.value || "all";
        renderBrowse();
      }
      if (e.target && e.target.id === "lb-notes-import") {
        var file = e.target.files && e.target.files[0];
        if (!file || !notesApi()) return;
        var reader = new FileReader();
        reader.onload = function () {
          try {
            var n = notesApi().importNotesJson(String(reader.result || ""));
            setNotesMsg("Imported " + n + " note" + (n === 1 ? "" : "s"), "ok");
            renderBrowse();
          } catch (err) {
            setNotesMsg(
              (err && err.message) || "Could not import notes",
              "error"
            );
          }
          e.target.value = "";
        };
        reader.readAsText(file);
        closeSettingsMenu();
      }
    });

    if (els.stageToggle) {
      els.stageToggle.addEventListener("click", function () {
        state.stage = !state.stage;
        storageSet(STAGE_KEY, state.stage ? "1" : "0");
        applyStageClass();
        renderBrowse();
      });
    }

    var fontDown = $("#lb-menu-font-down", root);
    var fontUp = $("#lb-menu-font-up", root);
    if (fontDown) {
      fontDown.addEventListener("click", function () {
        bumpTextSize(-1);
      });
    }
    if (fontUp) {
      fontUp.addEventListener("click", function () {
        bumpTextSize(1);
      });
    }

    var exportBtn = $("#lb-notes-export", root);
    var copyBtn = $("#lb-notes-copy", root);
    var shareBtn = $("#lb-notes-share", root);
    if (shareBtn && navigator.share) shareBtn.hidden = false;

    if (exportBtn) {
      exportBtn.addEventListener("click", function () {
        var N = notesApi();
        if (!N) return;
        var obj = exportNotesBundle();
        N.downloadExport(obj);
        setNotesMsg("Downloaded " + obj.count + " notes", "ok");
        closeSettingsMenu();
      });
    }
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        var N = notesApi();
        if (!N) return;
        var obj = exportNotesBundle();
        N.copyExport(obj)
          .then(function () {
            setNotesMsg("Copied notes JSON to clipboard", "ok");
          })
          .catch(function () {
            setNotesMsg("Could not copy — try Export", "error");
          });
        closeSettingsMenu();
      });
    }
    if (shareBtn) {
      shareBtn.addEventListener("click", function () {
        var N = notesApi();
        if (!N) return;
        var obj = exportNotesBundle();
        N.shareExport(obj).catch(function () {
          setNotesMsg("Share canceled", "info");
        });
        closeSettingsMenu();
      });
    }

    var menuPrint = $("#lb-menu-print", root);
    var menuSongbook = $("#lb-menu-songbook", root);
    if (menuPrint) {
      menuPrint.addEventListener("click", function () {
        var btn = document.getElementById("print-lyrics-btn");
        if (btn) btn.click();
        closeSettingsMenu();
      });
    }
    if (menuSongbook) {
      menuSongbook.addEventListener("click", function () {
        var btn = document.getElementById("download-songbook-btn");
        if (btn) btn.click();
        closeSettingsMenu();
      });
    }

    var gear = $("#lb-sync-gear", root);
    if (gear && els.syncPanel) {
      gear.addEventListener("click", function () {
        var open = els.syncPanel.hidden;
        els.syncPanel.hidden = !open;
        gear.setAttribute("aria-expanded", open ? "true" : "false");
        clearSyncFieldErrors();
        setSyncMsg("");
        if (open && notesApi()) {
          fillSyncForm(notesApi().loadSyncSettings());
        }
        closeSettingsMenu();
      });
    }
    var syncSave = $("#lb-sync-save", root);
    if (syncSave) {
      syncSave.addEventListener("click", function () {
        if (!notesApi()) return;
        var norm = notesApi().saveSyncSettings(readSyncForm());
        fillSyncForm(norm);
        if (Object.keys(norm.errors || {}).length) {
          showSyncFieldErrors(norm.errors);
          setSyncMsg(firstSyncError(norm.errors) || "Fix the fields above", "error");
          return;
        }
        clearSyncFieldErrors();
        setSyncMsg("Sync settings saved on this device", "ok");
        notesApi().flushQueue();
      });
    }
    var syncTest = $("#lb-sync-test", root);
    if (syncTest) {
      syncTest.addEventListener("click", function () {
        if (!notesApi()) return;
        var norm = notesApi().saveSyncSettings(readSyncForm());
        fillSyncForm(norm);
        if (Object.keys(norm.errors || {}).length) {
          showSyncFieldErrors(norm.errors);
          setSyncMsg(firstSyncError(norm.errors) || "Fix the fields above", "error");
          return;
        }
        clearSyncFieldErrors();
        setSyncMsg("Sending test…");
        notesApi()
          .sendTest()
          .then(function (res) {
            setSyncMsg((res && res.message) || "Test sent", "ok");
          })
          .catch(function (err) {
            if (err && err.errors) showSyncFieldErrors(err.errors);
            setSyncMsg((err && err.message) || "Test failed", "error");
          });
      });
    }
    var syncFlush = $("#lb-sync-flush", root);
    if (syncFlush) {
      syncFlush.addEventListener("click", function () {
        if (!notesApi()) return;
        notesApi().flushQueue().then(function () {
          setSyncMsg("Retry finished", "ok");
        });
      });
    }

    if (notesApi()) {
      notesApi().onChange(function () {
        if (!state.currentSlug) renderBrowse();
      });
      notesApi().flushQueue();
    }

    if (els.lockBtn) {
      els.lockBtn.addEventListener("click", function () {
        if (api && typeof api.lock === "function") api.lock();
      });
    }

    updateFiltersToggle();
    applyLayoutClass();
    syncLayoutMenu();
    if (els.fontLabel) {
      els.fontLabel.textContent = currentTextSize().toUpperCase();
    }

    bindSongGestures();

    window.addEventListener("hashchange", function () {
      if (!api) return;
      var slug =
        typeof api.parseSongHash === "function" ? api.parseSongHash() : "";
      if (!slug) {
        if (state.currentSlug) closeSongView();
        return;
      }
      if (slug !== state.currentSlug) openSongBySlug(slug, false);
    });

    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible" && state.currentSlug) {
        requestWakeLock();
      }
    });
  }

  function firstSyncError(errors) {
    if (!errors) return "";
    return errors.url || errors.header || errors.key || "";
  }

  function mount(browseApi) {
    api = browseApi;
    loadPrefs();
    loadSongsMetaFallback();
    applyStageClass();

    root = document.getElementById("lyrics-browse-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "lyrics-browse-root";
      var browser = document.getElementById("lyrics-browser");
      if (browser) browser.insertBefore(root, browser.firstChild);
      else return;
    }

    var browserEl = document.getElementById("lyrics-browser");
    if (browserEl) browserEl.classList.add("lb-active");

    root.innerHTML = shellHtml();
    bindShell();
    applyLayoutClass();
    renderBrowse();
    startPrefetch();

    var slug =
      api && typeof api.parseSongHash === "function" ? api.parseSongHash() : "";
    if (slug) openSongBySlug(slug, false);
  }

  function unmount() {
    state.prefetchAbort = true;
    stopAutoScroll();
    releaseWakeLock();
    applySongOpenClass(false);
    document.body.classList.remove("lb-stage");
    document.body.classList.remove("lb-layout-desktop", "lb-layout-touch");
    var browserEl = document.getElementById("lyrics-browser");
    if (browserEl) browserEl.classList.remove("lb-active");
    if (root) root.innerHTML = "";
    api = null;
    els = {};
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    var src =
      (document.body && document.body.getAttribute("data-lyrics-sw")) ||
      "/lyrics-sw.js";
    navigator.serviceWorker.register(src).catch(function () {
      /* optional */
    });
  }

  window.LyricsBrowse = {
    onUnlock: mount,
    onLock: unmount,
    isActive: function () {
      return !!api;
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", registerServiceWorker);
  } else {
    registerServiceWorker();
  }
})();
