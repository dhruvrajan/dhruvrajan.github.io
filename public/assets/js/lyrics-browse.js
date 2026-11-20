/**
 * Lyrics browse UI — accordion list, two-pane desktop / overlay touch.
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
  var EXPANDED_KEY = "lyrics_browse_expanded_v1";
  var NOTES_OPEN_KEY = "lyrics_browse_notes_open_v1";
  var CONTENT_VIEW_KEY = "lyrics_song_content_view_v1";
  var PREFETCH_CONCURRENCY = 4;
  var TEXT_SIZES = ["sm", "md", "lg"];
  var LAYOUT_MODES = ["auto", "desktop", "touch"];
  var INSTRUMENTS = ["Guitar", "Octave mandolin", "Banjo"];
  var INSTRUMENT_KEY = "lyrics_browse_instrument_v2";

  var api = null;
  var root = null;
  var state = {
    sort: "artist",
    query: "",
    instrumentFilter: "all",
    tuningFilter: "all",
    capoFilter: "all",
    artistFilter: "all",
    stage: false,
    filtersOpen: false,
    layoutMode: "auto",
    expanded: {},
    notesOpen: false,
    recent: [],
    setlist: [],
    order: [],
    groupOrder: [],
    currentSlug: null,
    currentGroupKey: null,
    listScrollTop: 0,
    focusIndex: -1,
    prefetch: { done: 0, total: 0, state: "idle", error: "" },
    autoScroll: false,
    scrollSpeed: 35,
    wakeLock: null,
    swipeStartX: 0,
    swipeStartY: 0,
    prefetchAbort: false,
    contentView: "lyrics",
    chordsText: null,
    chordsLoading: false,
    currentDetails: null,
    /** URL view: index | artists | artist | song */
    routeView: "index",
    /** List pane mode (unchanged while a song is open): index | artists | artist */
    listMode: "index",
    routeArtistSlug: "",
    /** URL to restore when Back has no in-app history (deep link). */
    backFallback: "/lyrics",
    applyingRoute: false,
    unsubRoute: null,
  };

  var els = {};
  var scrollTimer = null;
  var noteSaveTimer = null;
  var metaByTitleSlug = Object.create(null);

  function $(sel, ctx) {
    return (ctx || document).querySelector(sel);
  }

  function $$(sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

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

  function chordsApi() {
    return window.LyricsChords || null;
  }

  function getContentView() {
    var c = chordsApi();
    if (c && typeof c.getSongView === "function") return c.getSongView();
    return storageGet(CONTENT_VIEW_KEY, "lyrics") === "chords" ? "chords" : "lyrics";
  }

  function setContentView(mode) {
    var v = mode === "chords" ? "chords" : "lyrics";
    state.contentView = v;
    var c = chordsApi();
    if (c && typeof c.setSongView === "function") c.setSongView(v);
    else storageSet(CONTENT_VIEW_KEY, v);
    return v;
  }

  function songHasChords(slug) {
    var c = chordsApi();
    return !!(c && typeof c.hasChord === "function" && c.hasChord(slug));
  }

  function loadPrefs() {
    state.stage = storageGet(STAGE_KEY, "0") === "1";
    state.sort = storageGet(SORT_KEY, "artist") || "artist";
    state.contentView = getContentView();
    var inst = storageGet(INSTRUMENT_KEY, "all") || "all";
    state.instrumentFilter =
      INSTRUMENTS.indexOf(inst) !== -1 || inst === "all" ? inst : "all";
    var speed = Number(storageGet(SPEED_KEY, "35"));
    state.scrollSpeed = isNaN(speed) ? 35 : Math.min(120, Math.max(8, speed));
    state.filtersOpen = storageGet(FILTERS_OPEN_KEY, "0") === "1";
    var layout = storageGet(LAYOUT_KEY, "auto") || "auto";
    state.layoutMode = LAYOUT_MODES.indexOf(layout) !== -1 ? layout : "auto";
    state.notesOpen = storageGet(NOTES_OPEN_KEY, "0") === "1";
    var expanded = storageGetJson(EXPANDED_KEY, {});
    state.expanded =
      expanded && typeof expanded === "object" ? expanded : {};
    var recent = storageGetJson(RECENT_KEY, []);
    state.recent = Array.isArray(recent) ? recent.slice(0, 40) : [];
    var setlist = storageGetJson(SETLIST_KEY, []);
    state.setlist = Array.isArray(setlist) ? setlist.slice(0, 40) : [];
  }

  function persistExpanded() {
    storageSetJson(EXPANDED_KEY, state.expanded);
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

  function applyHasSongClass(open) {
    if (root) root.classList.toggle("lb-has-song", !!open);
    document.body.classList.toggle("lb-song-open", !!open);
  }

  function applyStageClass() {
    document.body.classList.toggle("lb-stage", !!state.stage);
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
      if (
        entry.tuning_unverified === true ||
        entry.tuning_unverified === "true"
      ) {
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
    return (
      metaByTitleSlug[titleSlug(song.title)] ||
      metaByTitleSlug[songSlug(song)] ||
      {}
    );
  }

  function normalizeInstruments(meta) {
    if (api && typeof api.normalizeInstruments === "function") {
      return api.normalizeInstruments(meta) || [];
    }
    if (window.LyricsSetup && window.LyricsSetup.normalizeInstruments) {
      return window.LyricsSetup.normalizeInstruments(meta) || [];
    }
    return [];
  }

  function instrumentsOf(song) {
    return normalizeInstruments(metaForSong(song));
  }

  function activeInstrumentName() {
    return state.instrumentFilter || "all";
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
    if (!list.length) return name === "Guitar";
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
    var t = tuningOf(song);
    if (t) parts.push(t + (tuningUnverified(song) && !/\?$/.test(String(t)) ? "?" : ""));
    var c = capoOf(song);
    if (c != null && c !== 0) parts.push("Capo " + c);
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

  /** Songs that have an encrypted lyrics file (excludes songs.yaml-only entries). */
  function lyricSongs() {
    return songs().filter(function (s) {
      return !s.noLyrics;
    });
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
        var c = tuningLabel(a).localeCompare(tuningLabel(b), undefined, {
          sensitivity: "base",
        });
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
    state.groupOrder = groups.map(function (g) {
      return g.key;
    });
    return groups;
  }

  function isFilterActive() {
    return !!(
      (state.query || "").trim() ||
      (state.tuningFilter && state.tuningFilter !== "all") ||
      (state.capoFilter && state.capoFilter !== "all") ||
      (state.artistFilter && state.artistFilter !== "all") ||
      (state.instrumentFilter && state.instrumentFilter !== "all")
    );
  }

  function isExpanded(key) {
    if (isFilterActive()) return true;
    return !!state.expanded[key];
  }

  function setExpanded(key, open) {
    if (open) state.expanded[key] = true;
    else delete state.expanded[key];
    persistExpanded();
  }

  function expandAll(groups) {
    (groups || []).forEach(function (g) {
      state.expanded[g.key] = true;
    });
    persistExpanded();
    renderBrowse();
  }

  function collapseAll() {
    state.expanded = {};
    persistExpanded();
    renderBrowse();
  }

  function activeFilterCount() {
    var n = 0;
    if (state.instrumentFilter && state.instrumentFilter !== "all") n += 1;
    if (state.tuningFilter && state.tuningFilter !== "all") n += 1;
    if (state.capoFilter && state.capoFilter !== "all") n += 1;
    if (state.artistFilter && state.artistFilter !== "all") n += 1;
    return n;
  }

  function updateFiltersToggle() {
    if (!els.filtersToggle) return;
    var n = activeFilterCount();
    els.filtersToggle.textContent = n ? "Filters (" + n + ")" : "Filters";
    els.filtersToggle.setAttribute(
      "aria-expanded",
      state.filtersOpen ? "true" : "false"
    );
    if (els.filtersPanel) els.filtersPanel.hidden = !state.filtersOpen;
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
    setTextSize(
      TEXT_SIZES[Math.min(TEXT_SIZES.length - 1, Math.max(0, i + delta))]
    );
  }

  function rememberRecent(slug) {
    if (!slug) return;
    state.recent = [slug]
      .concat(
        state.recent.filter(function (s) {
          return s !== slug;
        })
      )
      .slice(0, 40);
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
    if (state.currentSlug) renderSongView(state.currentSlug);
  }

  function saveListScroll() {
    var pane = els.listPane || els.list;
    if (pane) state.listScrollTop = pane.scrollTop || 0;
    else state.listScrollTop = window.scrollY || 0;
  }

  function restoreListScroll() {
    var top = state.listScrollTop || 0;
    requestAnimationFrame(function () {
      var pane = els.listPane || els.list;
      if (pane && typeof pane.scrollTop === "number") {
        pane.scrollTop = top;
      } else {
        window.scrollTo(0, top);
      }
    });
  }

  function slugsInCurrentGroup() {
    if (state.listMode === "artist" || state.listMode === "artists") {
      return state.order.slice();
    }
    if (!state.currentGroupKey) return state.order.slice();
    var key = state.currentGroupKey;
    return sortedSongs()
      .filter(function (s) {
        return groupKey(s) === key;
      })
      .map(songSlug);
  }

  function neighborInGroup(slug, delta) {
    var order = slugsInCurrentGroup();
    var i = order.indexOf(slug);
    if (i < 0) return null;
    var next = i + delta;
    if (next < 0 || next >= order.length) return null;
    return order[next];
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
    var btn = els.song && $("#lb-autoscroll", els.song);
    if (btn) {
      btn.setAttribute("aria-pressed", "false");
      btn.textContent = "Auto-scroll";
    }
  }

  function startAutoScroll() {
    stopAutoScroll();
    state.autoScroll = true;
    var btn = els.song && $("#lb-autoscroll", els.song);
    if (btn) {
      btn.setAttribute("aria-pressed", "true");
      btn.textContent = "Scrolling";
    }
    scrollTimer = setInterval(function () {
      if (!state.autoScroll) return;
      var step = Math.max(1, Math.round(state.scrollSpeed / 20));
      var target =
        effectiveLayout() === "touch"
          ? els.song
          : els.song || window;
      if (target === window) window.scrollBy(0, step);
      else if (target) target.scrollTop += step;
    }, 50);
  }

  function updatePrefetchUi() {
    if (!els.prefetch) return;
    els.prefetch.hidden = state.prefetch.state === "idle";
    els.prefetch.setAttribute("data-state", state.prefetch.state);
    if (!els.prefetchText) return;
    if (state.prefetch.state === "loading") {
      els.prefetchText.textContent =
        "Caching " + state.prefetch.done + " / " + state.prefetch.total;
    } else if (state.prefetch.state === "ready") {
      els.prefetchText.textContent =
        "All " + state.prefetch.total + " songs ready offline";
    } else if (state.prefetch.state === "error") {
      els.prefetchText.textContent =
        "Cached " + state.prefetch.done + " / " + state.prefetch.total;
    }
  }

  async function mapPool(items, limit, worker, onProgress) {
    var i = 0;
    var done = 0;
    async function run() {
      while (i < items.length) {
        if (state.prefetchAbort) return;
        var idx = i++;
        try {
          await worker(items[idx], idx);
        } catch (e) {
          /* ignore */
        }
        done += 1;
        if (onProgress) onProgress(done, items.length);
      }
    }
    var runners = [];
    for (var n = 0; n < Math.min(limit, items.length); n++) runners.push(run());
    await Promise.all(runners);
  }

  function startPrefetch() {
    if (!api || typeof api.loadSongDetails !== "function") return;
    var list = lyricSongs();
    state.prefetchAbort = false;
    state.prefetch = { done: 0, total: list.length, state: "loading", error: "" };
    updatePrefetchUi();
    mapPool(
      list,
      PREFETCH_CONCURRENCY,
      function (song) {
        return api.loadSongDetails(song);
      },
      function (done, total) {
        state.prefetch.done = done;
        state.prefetch.total = total;
        updatePrefetchUi();
      }
    ).then(function () {
      if (state.prefetchAbort) return;
      state.prefetch.state =
        state.prefetch.done === list.length ? "ready" : "error";
      updatePrefetchUi();
    });
  }

  function artistSlugOf(name) {
    if (api && typeof api.artistSlug === "function") return api.artistSlug(name);
    return titleSlug(name || "Other");
  }

  function findArtistBySlug(slug) {
    if (!slug) return "";
    var want = String(slug).toLowerCase();
    var names = uniqueSorted(
      songs().map(function (s) {
        return s.artist || "Other";
      })
    );
    for (var i = 0; i < names.length; i++) {
      if (artistSlugOf(names[i]) === want) return names[i];
    }
    return "";
  }

  function indexFiltersPayload() {
    return {
      view: "index",
      q: state.query || "",
      sort: state.sort || "artist",
      instrument: state.instrumentFilter || "all",
      tuning: state.tuningFilter || "all",
      capo: state.capoFilter || "all",
      artist: state.artistFilter || "all",
    };
  }

  function currentListUrl() {
    if (state.listMode === "artist" && state.routeArtistSlug) {
      return "/lyrics/artists/" + encodeURIComponent(state.routeArtistSlug);
    }
    if (state.listMode === "artists") return "/lyrics/artists";
    var f = indexFiltersPayload();
    var params = new URLSearchParams();
    if ((f.q || "").trim()) params.set("q", f.q.trim());
    if (f.sort && f.sort !== "artist") params.set("sort", f.sort);
    if (f.instrument && f.instrument !== "all") params.set("instrument", f.instrument);
    if (f.tuning && f.tuning !== "all") params.set("tuning", f.tuning);
    if (f.capo && f.capo !== "all") params.set("capo", f.capo);
    if (f.artist && f.artist !== "all") params.set("artist", f.artist);
    var qs = params.toString();
    return qs ? "/lyrics?" + qs : "/lyrics";
  }

  function syncIndexUrl() {
    if (state.applyingRoute) return;
    if (state.listMode !== "index" || state.routeView === "song") return;
    if (!api || typeof api.goIndex !== "function") return;
    api.goIndex(indexFiltersPayload(), { replace: true });
  }

  function shellHtml() {
    return (
      '<div class="lb-shell">' +
      '<div class="lb-pane-list" id="lb-pane-list">' +
      '<div class="lb-chrome">' +
      '<nav class="lb-mode-nav" aria-label="Lyrics browse mode">' +
      '<a class="lb-mode-nav__link" id="lb-mode-all" href="/lyrics">All songs</a>' +
      '<a class="lb-mode-nav__link" id="lb-mode-artists" href="/lyrics/artists">By artist</a>' +
      "</nav>" +
      '<div class="lb-bar" id="lb-bar-search">' +
      '<div class="lb-bar__grow">' +
      '<label class="visually-hidden" for="lb-search">Search songs</label>' +
      '<input id="lb-search" class="lb-search" type="search" placeholder="Search title or artist" enterkeyhint="search" autocomplete="off">' +
      "</div>" +
      '<button type="button" class="lb-btn lb-btn--subtle" id="lb-filters-toggle" aria-expanded="false" aria-controls="lb-filters-panel">Filters</button>' +
      '<label class="visually-hidden" for="lb-sort">Sort</label>' +
      '<select id="lb-sort" class="lb-select lb-select--sort">' +
      '<option value="artist">Artist</option>' +
      '<option value="title">Title</option>' +
      '<option value="tuning">Tuning</option>' +
      '<option value="capo">Capo</option>' +
      '<option value="recent">Recent</option>' +
      "</select>" +
      '<div class="lb-overflow">' +
      '<button type="button" class="lb-btn lb-btn--subtle" id="lb-settings-btn" aria-expanded="false" aria-haspopup="true" aria-controls="lb-settings-menu" aria-label="Settings">⋯</button>' +
      '<div class="lb-menu" id="lb-settings-menu" role="menu" hidden>' +
      '<div class="lb-menu__section">' +
      '<p class="lb-menu__label">Text size</p>' +
      '<div class="lb-menu__row">' +
      '<button type="button" class="lb-btn lb-btn--subtle" id="lb-menu-font-down" aria-label="Smaller text">A−</button>' +
      '<span class="lb-menu__value" id="lb-font-label">MD</span>' +
      '<button type="button" class="lb-btn lb-btn--subtle" id="lb-menu-font-up" aria-label="Larger text">A+</button>' +
      "</div></div>" +
      '<div class="lb-menu__section">' +
      '<button type="button" class="lb-menu__item" id="lb-stage-toggle" role="menuitemcheckbox" aria-checked="false">Stage mode</button>' +
      "</div>" +
      '<div class="lb-menu__section">' +
      '<p class="lb-menu__label">Layout</p>' +
      '<div class="lb-menu__row" role="group" aria-label="Layout mode">' +
      '<button type="button" class="lb-btn lb-btn--subtle" data-layout-mode="auto" aria-pressed="true">Auto</button>' +
      '<button type="button" class="lb-btn lb-btn--subtle" data-layout-mode="desktop" aria-pressed="false">Desktop</button>' +
      '<button type="button" class="lb-btn lb-btn--subtle" data-layout-mode="touch" aria-pressed="false">Touch</button>' +
      "</div></div>" +
      '<div class="lb-menu__section">' +
      '<p class="lb-menu__label">Notes</p>' +
      '<button type="button" class="lb-menu__item" id="lb-notes-export" role="menuitem">Export notes</button>' +
      '<button type="button" class="lb-menu__item" id="lb-notes-copy" role="menuitem">Copy notes</button>' +
      '<button type="button" class="lb-menu__item" id="lb-notes-share" role="menuitem" hidden>Share notes</button>' +
      '<label class="lb-menu__item lb-file-btn" for="lb-notes-import" role="menuitem">Import notes<input id="lb-notes-import" type="file" accept="application/json,.json" hidden></label>' +
      "</div>" +
      '<div class="lb-menu__section">' +
      '<button type="button" class="lb-menu__item" id="lb-menu-print" role="menuitem">Print song</button>' +
      '<button type="button" class="lb-menu__item" id="lb-menu-songbook" role="menuitem">Download songbook PDF</button>' +
      '<label class="lb-menu__item lb-menu__orient" for="lb-songbook-orientation">Page ' +
      '<select id="lb-songbook-orientation" data-songbook-orientation>' +
      '<option value="portrait">Portrait</option>' +
      '<option value="landscape">Landscape</option>' +
      "</select></label>" +
      '<button type="button" class="lb-menu__item" id="lb-lock" role="menuitem">Lock</button>' +
      "</div>" +
      "</div></div>" +
      "</div>" +
      '<div class="lb-filters-panel" id="lb-filters-panel" hidden>' +
      '<div class="lb-filters" id="lb-filters"></div>' +
      "</div>" +
      '<p class="lb-status" id="lb-notes-msg" hidden aria-live="polite"></p>' +
      '<div class="lb-prefetch" id="lb-prefetch" hidden data-state="idle">' +
      '<span class="lb-prefetch__dot" aria-hidden="true"></span>' +
      '<span id="lb-prefetch-text"></span>' +
      "</div>" +
      '<div class="lb-accordion-tools" id="lb-accordion-tools">' +
      '<p class="lb-status" id="lb-status" aria-live="polite"></p>' +
      '<div class="lb-accordion-tools__actions">' +
      '<button type="button" class="lb-linkish" id="lb-expand-all">Expand all</button>' +
      '<button type="button" class="lb-linkish" id="lb-collapse-all">Collapse all</button>' +
      "</div></div>" +
      "</div>" +
      '<div class="lb-list" id="lb-list" role="tree" aria-label="Songs by group"></div>' +
      "</div>" +
      '<div class="lb-pane-song" id="lb-song" hidden></div>' +
      "</div>"
    );
  }


  function renderFilters() {
    if (!els.filters) return;
    var pool = songs().filter(function (s) {
      return songHasInstrument(s, activeInstrumentName());
    });
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
    html += '<div class="lb-filter-row"><span class="lb-filter-label">Instrument</span>';
    html +=
      '<button type="button" class="lb-chip" data-instrument="all" aria-pressed="' +
      (state.instrumentFilter === "all" ? "true" : "false") +
      '">All</button>';
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

    html += '<div class="lb-filter-row"><span class="lb-filter-label">Tuning</span>';
    html +=
      '<button type="button" class="lb-chip" data-tuning="all" aria-pressed="' +
      (state.tuningFilter === "all" ? "true" : "false") +
      '">All</button>';
    tunings.forEach(function (t) {
      html +=
        '<button type="button" class="lb-chip" data-tuning="' +
        escapeHtml(t) +
        '" aria-pressed="' +
        (state.tuningFilter === t ? "true" : "false") +
        '">' +
        escapeHtml(t) +
        "</button>";
    });
    html += "</div>";

    html += '<div class="lb-filter-row"><span class="lb-filter-label">Capo</span>';
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

    html +=
      '<div class="lb-filter-row"><label class="lb-filter-label" for="lb-artist">Artist</label>';
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

  function updateModeNav() {
    var listMode = state.listMode || "index";
    if (root) root.setAttribute("data-lb-list-mode", listMode);
    if (els.modeAll) {
      els.modeAll.classList.toggle("is-active", listMode === "index");
      if (listMode === "index") els.modeAll.setAttribute("aria-current", "page");
      else els.modeAll.removeAttribute("aria-current");
    }
    if (els.modeArtists) {
      var artistMode = listMode === "artists" || listMode === "artist";
      els.modeArtists.classList.toggle("is-active", artistMode);
      if (listMode === "artists") {
        els.modeArtists.setAttribute("aria-current", "page");
      } else {
        els.modeArtists.removeAttribute("aria-current");
      }
    }
    var showSearch = listMode === "index";
    if (els.barSearch) els.barSearch.hidden = !showSearch;
    if (els.filtersPanel && !showSearch) els.filtersPanel.hidden = true;
    if (els.expandActions) els.expandActions.hidden = !showSearch;
  }

  function songRowHtml(song, groupKey) {
    var slug = songSlug(song);
    var setup = formatSetup(song);
    var noted = songHasNotes(slug);
    var selected = state.currentSlug === slug;
    return (
      '<li class="lb-song-item" role="none">' +
      '<button type="button" class="lb-song' +
      (song.noLyrics ? " lb-song--no-lyrics" : "") +
      '" data-open-slug="' +
      escapeHtml(slug) +
      '"' +
      (groupKey
        ? ' data-group-key="' + escapeHtml(groupKey) + '"'
        : "") +
      (selected ? ' aria-current="true"' : "") +
      ">" +
      '<span class="lb-song__title">' +
      escapeHtml(song.title) +
      (noted
        ? '<span class="lb-note-dot" title="Has notes" aria-label="Has notes"></span>'
        : "") +
      "</span>" +
      (setup
        ? '<span class="lb-song__setup">' + escapeHtml(setup) + "</span>"
        : "") +
      "</button></li>"
    );
  }

  function renderArtistIndex() {
    if (!els.list) return;
    updateModeNav();
    var names = uniqueSorted(
      songs().map(function (s) {
        return s.artist || "Other";
      })
    );
    if (els.status) {
      els.status.textContent =
        names.length + " artist" + (names.length === 1 ? "" : "s");
    }
    if (!names.length) {
      els.list.innerHTML = '<p class="lb-empty">No artists to show.</p>';
      return;
    }
    var html =
      '<ul class="lb-artist-list" role="list" aria-label="Artists">';
    names.forEach(function (name) {
      var slug = artistSlugOf(name);
      var count = songs().filter(function (s) {
        return (s.artist || "Other") === name;
      }).length;
      html +=
        '<li class="lb-artist-item">' +
        '<a class="lb-artist" href="/lyrics/artists/' +
        encodeURIComponent(slug) +
        '" data-artist-slug="' +
        escapeHtml(slug) +
        '">' +
        '<span class="lb-artist__name">' +
        escapeHtml(name) +
        "</span>" +
        '<span class="lb-artist__count">' +
        count +
        "</span>" +
        "</a></li>";
    });
    html += "</ul>";
    els.list.innerHTML = html;
    els.list.setAttribute("role", "list");
    els.list.setAttribute("aria-label", "Artists");
  }

  function renderArtistSongs(artistSlug) {
    if (!els.list) return;
    updateModeNav();
    var artistName = findArtistBySlug(artistSlug);
    var list = songs()
      .filter(function (s) {
        return artistSlugOf(s.artist || "Other") === String(artistSlug || "");
      })
      .slice()
      .sort(compareTitle);
    state.order = list.map(songSlug);
    state.groupOrder = artistName ? [artistName] : [];

    if (els.status) {
      els.status.textContent = artistName
        ? list.length +
          " song" +
          (list.length === 1 ? "" : "s") +
          " · " +
          artistName
        : "Artist not found";
    }

    var html =
      '<div class="lb-artist-header">' +
      '<a class="lb-linkish lb-artist-back" href="/lyrics/artists" data-go-artists>All artists</a>' +
      '<h2 class="lb-artist-heading">' +
      escapeHtml(artistName || artistSlug || "Artist") +
      "</h2></div>";

    if (!list.length) {
      html += '<p class="lb-empty">No songs for this artist.</p>';
      els.list.innerHTML = html;
      return;
    }

    html +=
      '<ul class="lb-song-list" role="list" aria-label="Songs by ' +
      escapeHtml(artistName || "artist") +
      '">';
    list.forEach(function (song) {
      html += songRowHtml(song, artistName || "");
    });
    html += "</ul>";
    els.list.innerHTML = html;
    els.list.setAttribute("role", "list");
    els.list.setAttribute("aria-label", "Songs by artist");
  }

  function renderBrowse() {
    if (!els.list) return;

    if (state.listMode === "artists") {
      renderArtistIndex();
      return;
    }
    if (state.listMode === "artist") {
      renderArtistSongs(state.routeArtistSlug);
      return;
    }

    updateModeNav();
    els.list.setAttribute("role", "tree");
    els.list.setAttribute("aria-label", "Songs by group");

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
      try {
        els.sortSelect.value = state.sort;
      } catch (e) {
        /* ignore */
      }
    }

    if (els.stageToggle) {
      els.stageToggle.setAttribute(
        "aria-checked",
        state.stage ? "true" : "false"
      );
      els.stageToggle.textContent = state.stage ? "Stage on" : "Stage mode";
    }

    updateFiltersToggle();
    $$("[data-layout-mode]", root).forEach(function (btn) {
      btn.setAttribute(
        "aria-pressed",
        btn.getAttribute("data-layout-mode") === state.layoutMode
          ? "true"
          : "false"
      );
    });
    if (els.fontLabel) {
      els.fontLabel.textContent = currentTextSize().toUpperCase();
    }

    renderFilters();

    if (!list.length) {
      els.list.innerHTML =
        '<p class="lb-empty">Nothing matches. Clear search or filters to see songs.</p>';
      return;
    }

    var html = "";
    groups.forEach(function (group, gi) {
      var id = "lb-group-" + gi;
      var open = isExpanded(group.key);
      html +=
        '<div class="lb-group" role="treeitem" aria-expanded="' +
        (open ? "true" : "false") +
        '" data-group-key="' +
        escapeHtml(group.key) +
        '">';
      html +=
        '<button type="button" class="lb-group__toggle" id="' +
        id +
        '-btn" aria-expanded="' +
        (open ? "true" : "false") +
        '" aria-controls="' +
        id +
        '-body" data-toggle-group="' +
        escapeHtml(group.key) +
        '">' +
        "<span>" +
        escapeHtml(group.key) +
        "</span>" +
        '<span class="lb-group__count">' +
        group.songs.length +
        "</span>" +
        "</button>";
      html +=
        '<ul class="lb-group__body" id="' +
        id +
        '-body" role="group"' +
        (open ? "" : " hidden") +
        ">";
      group.songs.forEach(function (song) {
        html += songRowHtml(song, group.key);
      });
      html += "</ul></div>";
    });
    els.list.innerHTML = html;
  }

  function closeSettingsMenu() {
    if (els.settingsMenu) els.settingsMenu.hidden = true;
    if (els.settingsBtn) {
      els.settingsBtn.setAttribute("aria-expanded", "false");
    }
  }

  function flushNote(slug, meta, details) {
    var N = notesApi();
    var ta = els.song && $("#lb-notes-ta", els.song);
    if (!N || !ta || !slug) return;
    N.setNote(slug, {
      title: (details && details.title) || (meta && meta.title) || "",
      artist: (details && details.artist) || (meta && meta.artist) || "",
      notes: ta.value,
    });
  }

  function bindNotesInline(meta, details) {
    var slug = songSlug(meta);
    var N = notesApi();
    var toggle = $("#lb-notes-toggle", els.song);
    var panel = $("#lb-notes-panel", els.song);
    var ta = $("#lb-notes-ta", els.song);
    if (!toggle || !panel || !ta) return;

    function setOpen(open) {
      state.notesOpen = !!open;
      storageSet(NOTES_OPEN_KEY, state.notesOpen ? "1" : "0");
      panel.hidden = !state.notesOpen;
      toggle.setAttribute("aria-expanded", state.notesOpen ? "true" : "false");
      toggle.textContent = state.notesOpen ? "Hide notes" : "Notes";
    }

    setOpen(state.notesOpen);
    if (N) {
      var entry = N.getNote(slug);
      ta.value = entry && entry.notes ? entry.notes : "";
    }

    toggle.onclick = function () {
      setOpen(panel.hidden);
      if (state.notesOpen) ta.focus();
    };

    ta.oninput = function () {
      if (noteSaveTimer) clearTimeout(noteSaveTimer);
      noteSaveTimer = setTimeout(function () {
        flushNote(slug, meta, details);
        renderBrowse();
      }, 400);
    };
    ta.onblur = function () {
      if (noteSaveTimer) clearTimeout(noteSaveTimer);
      flushNote(slug, meta, details);
      renderBrowse();
    };
  }

  function songBodyHtml(slug, meta, details, hasChords) {
    if (meta.noLyrics || (details && details.noLyrics)) {
      return '<p class="lb-lyrics-empty">Lyrics not added yet</p>';
    }
    var view = hasChords && state.contentView === "chords" ? "chords" : "lyrics";
    if (view === "chords") {
      if (state.chordsLoading) {
        return '<p class="lb-loading">Loading chords…</p>';
      }
      if (state.chordsText) {
        return (
          '<pre class="lb-lyrics lb-lyrics--chords">' +
          escapeHtml(state.chordsText) +
          "</pre>"
        );
      }
      return '<p class="lb-status lb-status--error">Chord sheet unavailable.</p>';
    }
    if (!details) {
      return '<p class="lb-loading">Loading lyrics…</p>';
    }
    var html =
      '<pre class="lb-lyrics">' +
      escapeHtml(details.lyrics || details.text || "") +
      "</pre>";
    if (details.copyright || details.attribution) {
      html +=
        '<p class="lb-attrib">' +
        escapeHtml(details.copyright || details.attribution) +
        "</p>";
    }
    return html;
  }

  function renderSongBody(slug, meta, details) {
    var body = $("#lb-song-body", els.song);
    if (!body) return;
    body.innerHTML = songBodyHtml(slug, meta, details, songHasChords(slug));
  }

  function syncContentToggle() {
    if (!els.song) return;
    var view = state.contentView === "chords" ? "chords" : "lyrics";
    $$("[data-content-view]", els.song).forEach(function (btn) {
      btn.setAttribute(
        "aria-pressed",
        btn.getAttribute("data-content-view") === view ? "true" : "false"
      );
    });
  }

  function loadChordsForSong(slug, meta, details) {
    var c = chordsApi();
    if (!c || typeof c.loadSheet !== "function" || !songHasChords(slug)) {
      state.chordsText = null;
      state.chordsLoading = false;
      return Promise.resolve();
    }
    state.chordsLoading = true;
    renderSongBody(slug, meta, details);
    return c
      .loadSheet(slug)
      .then(function (sheet) {
        if (state.currentSlug !== slug) return;
        state.chordsText = c.extractChordsText(sheet);
        state.chordsLoading = false;
        renderSongBody(slug, meta, details);
      })
      .catch(function (err) {
        if (state.currentSlug !== slug) return;
        state.chordsLoading = false;
        if (api && api.isAccessError && api.isAccessError(err)) {
          var body = $("#lb-song-body", els.song);
          if (body && api.accessPromptHtml) {
            body.innerHTML = api.accessPromptHtml();
            if (api.bindAccessReload) api.bindAccessReload(body);
          }
          return;
        }
        state.chordsText = null;
        renderSongBody(slug, meta, details);
      });
  }

  function renderSongView(slug, opts) {
    opts = opts || {};
    var meta =
      typeof api.findSongBySlug === "function"
        ? api.findSongBySlug(slug)
        : songs().filter(function (s) {
            return songSlug(s) === slug;
          })[0];
    if (!meta || !els.song) return;

    var details =
      opts.details !== undefined ? opts.details : state.currentDetails;
    if (opts.details !== undefined) state.currentDetails = opts.details;
    var prev = neighborInGroup(slug, -1);
    var next = neighborInGroup(slug, 1);
    var setup = formatSetup(meta);
    var touch = effectiveLayout() === "touch";

    var html = '<div class="lb-song-view">';
    html += '<div class="lb-song-view__top">';
    html += '<div class="lb-song-view__actions" role="group" aria-label="Song tools">';
    if (touch) {
      html +=
        '<button type="button" class="lb-btn lb-btn--subtle" id="lb-back">Back</button>';
    } else {
      html +=
        '<button type="button" class="lb-btn lb-btn--subtle" id="lb-back">Close</button>';
    }
    html +=
      '<button type="button" class="lb-btn lb-btn--subtle" id="lb-song-stage" aria-pressed="' +
      (state.stage ? "true" : "false") +
      '">' +
      (state.stage ? "Stage on" : "Stage") +
      "</button>";
    html +=
      '<button type="button" class="lb-btn lb-btn--subtle" id="lb-font-down" aria-label="Smaller text">A−</button>';
    html +=
      '<button type="button" class="lb-btn lb-btn--subtle" id="lb-font-up" aria-label="Larger text">A+</button>';
    html +=
      '<button type="button" class="lb-btn lb-btn--subtle" id="lb-song-pin" aria-pressed="' +
      (isPinned(slug) ? "true" : "false") +
      '">' +
      (isPinned(slug) ? "Pinned" : "Pin") +
      "</button>";
    html += "</div>";
    html +=
      '<h2 class="lb-song-view__title">' +
      escapeHtml(meta.title) +
      "</h2>";
    html += '<p class="lb-song-view__meta">';
    html +=
      '<span class="lb-song-view__artist">' +
      escapeHtml(meta.artist || "") +
      "</span>";
    if (setup) {
      html +=
        '<span class="lb-setup-line">' + escapeHtml(setup) + "</span>";
    }
    html += "</p>";
    html += "</div>";

    html +=
      '<div class="lb-notes">' +
      '<button type="button" class="lb-notes__toggle" id="lb-notes-toggle" aria-expanded="false" aria-controls="lb-notes-panel">Notes</button>' +
      '<div class="lb-notes__panel" id="lb-notes-panel" hidden>' +
      '<label class="visually-hidden" for="lb-notes-ta">Song notes</label>' +
      '<textarea class="lb-notes__ta" id="lb-notes-ta" rows="4" placeholder="Personal notes for this song…"></textarea>' +
      '<p class="lb-notes__hint">Saved on this device. Export from Settings.</p>' +
      "</div></div>";

    var printNote =
      notesApi() && notesApi().getNote ? notesApi().getNote(slug) : null;
    var printNoteText =
      printNote && printNote.notes != null ? String(printNote.notes) : "";
    if (printNoteText.trim()) {
      // Print-only copy of this song's notes, shown above the lyrics.
      html +=
        '<div class="lb-print-notes"><p class="lb-print-notes__label">Notes</p>' +
        '<p class="lb-print-notes__text">' +
        escapeHtml(printNoteText.replace(/\s+$/, "")) +
        "</p></div>";
    }
    var hasChords = songHasChords(slug);
    if (hasChords) {
      var view = state.contentView === "chords" ? "chords" : "lyrics";
      html +=
        '<div class="lb-content-toggle" role="group" aria-label="Song content">' +
        '<button type="button" class="lb-btn lb-btn--subtle" data-content-view="lyrics" aria-pressed="' +
        (view === "lyrics" ? "true" : "false") +
        '">Lyrics</button>' +
        '<button type="button" class="lb-btn lb-btn--subtle" data-content-view="chords" aria-pressed="' +
        (view === "chords" ? "true" : "false") +
        '">Chords</button>' +
        "</div>";
    }

    html += '<div id="lb-song-body">';
    html += songBodyHtml(slug, meta, details, hasChords);
    html += "</div>";

    html += '<div class="lb-dock">';
    html += '<div class="lb-dock__nav">';
    html +=
      '<button type="button" class="lb-btn lb-btn--subtle" id="lb-prev"' +
      (prev ? "" : " disabled") +
      ">Previous</button>";
    html +=
      '<button type="button" class="lb-btn lb-btn--subtle" id="lb-next"' +
      (next ? "" : " disabled") +
      ">Next</button>";
    html += "</div>";
    html +=
      '<button type="button" class="lb-btn lb-btn--subtle" id="lb-autoscroll" aria-pressed="false">Auto-scroll</button>';
    html +=
      '<label class="lb-speed">Speed <input id="lb-speed" type="range" min="8" max="120" value="' +
      state.scrollSpeed +
      '"></label>';
    html += "</div></div>";

    els.song.innerHTML = html;
    els.song.hidden = false;

    $("#lb-back", els.song).addEventListener("click", function () {
      flushNote(slug, meta, details);
      requestCloseSong();
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
      renderSongView(slug, { details: details });
    });
    $("#lb-song-pin", els.song).addEventListener("click", function () {
      togglePin(slug);
    });
    $("#lb-prev", els.song).addEventListener("click", function () {
      if (prev) openSongBySlug(prev, true, { replaceUrl: true });
    });
    $("#lb-next", els.song).addEventListener("click", function () {
      if (next) openSongBySlug(next, true, { replaceUrl: true });
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
    bindNotesInline(meta, details);

    $$("[data-content-view]", els.song).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var next = btn.getAttribute("data-content-view");
        setContentView(next);
        syncContentToggle();
        if (next === "chords" && !state.chordsText && !state.chordsLoading) {
          loadChordsForSong(slug, meta, details);
        } else {
          renderSongBody(slug, meta, details);
        }
      });
    });
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

    if (!state.currentSlug) saveListScroll();

    if (state.routeView !== "song") {
      state.backFallback = currentListUrl();
    }

    if (state.listMode === "index") sortedSongs();
    rememberRecent(slug);
    state.currentSlug = slug;
    if (opts.groupKey) state.currentGroupKey = opts.groupKey;
    else if (state.listMode === "artist") {
      state.currentGroupKey =
        findArtistBySlug(state.routeArtistSlug) || groupKey(meta);
    } else {
      state.currentGroupKey = groupKey(meta);
    }

    stopAutoScroll();
    applyLayoutClass();
    applyHasSongClass(true);
    state.chordsText = null;
    state.chordsLoading = false;
    state.currentDetails = null;
    state.contentView = getContentView();
    renderSongView(slug);
    renderBrowse();
    requestWakeLock();

    if (updateHash && typeof api.setHashForSong === "function") {
      api.setHashForSong(meta, { replace: !!opts.replaceUrl });
    }

    // Do not scroll the page — keep list position; song pane scrolls itself.
    if (effectiveLayout() === "touch" && els.song) {
      els.song.scrollTop = 0;
    }

    var chordsReady = chordsApi()
      ? chordsApi()
          .ensureIndex(api)
          .then(function () {
            if (state.currentSlug !== slug) return;
            // Re-render once index knows whether this song has chords.
            renderSongView(slug);
          })
          .catch(function (err) {
            if (state.currentSlug !== slug) return;
            if (api && api.isAccessError && api.isAccessError(err)) {
              var body = $("#lb-song-body", els.song);
              if (body && api.accessPromptHtml) {
                body.innerHTML = api.accessPromptHtml();
                if (api.bindAccessReload) api.bindAccessReload(body);
              }
            }
          })
      : Promise.resolve();

    api
      .loadSongDetails(meta)
      .then(function (details) {
        if (state.currentSlug !== slug) return;
        return chordsReady.then(function () {
          if (state.currentSlug !== slug) return;
          renderSongView(slug, { details: details });
          if (state.contentView === "chords" && songHasChords(slug)) {
            return loadChordsForSong(slug, meta, details);
          }
        });
      })
      .catch(function (err) {
        if (state.currentSlug !== slug) return;
        var body = $("#lb-song-body", els.song);
        if (!body) return;
        if (api && api.isAccessError && api.isAccessError(err)) {
          body.innerHTML = api.accessPromptHtml
            ? api.accessPromptHtml()
            : '<p class="lb-status lb-status--error">Sign in to view lyrics</p>';
          if (api.bindAccessReload) api.bindAccessReload(body);
          return;
        }
        body.innerHTML =
          '<p class="lb-status lb-status--error">' +
          escapeHtml((err && err.message) || "Could not load lyrics.") +
          "</p>";
      });
  }

  /** Close song via history.back when possible; else fall back to list URL. */
  function requestCloseSong() {
    var fallback = state.backFallback || "/lyrics";
    if (api && typeof api.backOr === "function") {
      api.backOr(fallback);
      return;
    }
    closeSongViewLocal();
    if (api && typeof api.goIndex === "function") {
      api.goIndex(indexFiltersPayload(), { replace: true });
    }
  }

  function closeSongViewLocal() {
    stopAutoScroll();
    releaseWakeLock();
    state.currentSlug = null;
    state.currentGroupKey = null;
    applyHasSongClass(false);
    if (els.song) {
      els.song.hidden = true;
      els.song.innerHTML = "";
    }
    restoreListScroll();
  }

  function closeSongView() {
    requestCloseSong();
  }

  function applyFiltersFromRoute(route) {
    if (!route) return;
    if (route.q != null) state.query = String(route.q || "");
    if (route.sort) state.sort = route.sort;
    if (route.instrument) state.instrumentFilter = route.instrument;
    if (route.tuning) state.tuningFilter = route.tuning;
    if (route.capo) state.capoFilter = route.capo;
    if (route.artist) state.artistFilter = route.artist;
    if (els.search && state.query !== els.search.value) {
      els.search.value = state.query;
    }
  }

  function applyRoute(route) {
    if (!route || !api) return;
    state.applyingRoute = true;
    try {
      var view = route.view || "index";
      state.routeView = view;

      if (view === "song" && route.songSlug) {
        // Deep link with no prior list: fall back to index on Back.
        if (!state.backFallback || state.backFallback === "/lyrics/song/" + route.songSlug) {
          state.backFallback = "/lyrics";
          state.listMode = "index";
        }
        if (state.currentSlug !== route.songSlug) {
          openSongBySlug(route.songSlug, false);
        } else {
          applyHasSongClass(true);
          if (!state.currentDetails) {
            /* still loading */
          }
          renderBrowse();
        }
        return;
      }

      if (view === "artists") {
        state.listMode = "artists";
        state.routeArtistSlug = "";
      } else if (view === "artist") {
        state.listMode = "artist";
        state.routeArtistSlug = route.artistSlug || "";
      } else {
        state.listMode = "index";
        state.routeArtistSlug = "";
        applyFiltersFromRoute(route);
      }

      if (state.currentSlug) {
        closeSongViewLocal();
      }
      renderBrowse();
    } finally {
      state.applyingRoute = false;
    }
  }

  function visibleNavItems() {
    if (!els.list) return [];
    var items = [];
    $$(".lb-group", els.list).forEach(function (group) {
      var toggle = $(".lb-group__toggle", group);
      if (toggle) items.push(toggle);
      var body = $(".lb-group__body", group);
      if (body && !body.hidden) {
        $$(".lb-song", body).forEach(function (song) {
          items.push(song);
        });
      }
    });
    return items;
  }

  function focusNavIndex(i) {
    var items = visibleNavItems();
    if (!items.length) return;
    if (i < 0) i = 0;
    if (i >= items.length) i = items.length - 1;
    state.focusIndex = i;
    items[i].focus();
  }

  function onGlobalKeydown(e) {
    if (!root || !api) return;
    var tag = (e.target && e.target.tagName) || "";
    var typing =
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT" ||
      (e.target && e.target.isContentEditable);

    if (e.key === "/" && !typing) {
      e.preventDefault();
      if (els.search) els.search.focus();
      return;
    }

    if (e.key === "Escape") {
      if (typing && e.target === els.search && els.search.value) {
        els.search.value = "";
        state.query = "";
        renderBrowse();
        syncIndexUrl();
        return;
      }
      if (els.settingsMenu && !els.settingsMenu.hidden) {
        closeSettingsMenu();
        return;
      }
      if (state.currentSlug) {
        e.preventDefault();
        requestCloseSong();
      }
      return;
    }

    if (state.currentSlug && effectiveLayout() === "desktop" && !typing) {
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        var n1 = neighborInGroup(state.currentSlug, 1);
        if (n1) openSongBySlug(n1, true, { replaceUrl: true });
        return;
      }
      if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        var n2 = neighborInGroup(state.currentSlug, -1);
        if (n2) openSongBySlug(n2, true, { replaceUrl: true });
        return;
      }
    }

    if (typing || state.currentSlug) return;

    var items = visibleNavItems();
    if (!items.length) return;
    var active = document.activeElement;
    var idx = items.indexOf(active);
    if (idx < 0) idx = state.focusIndex;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusNavIndex(idx < 0 ? 0 : idx + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusNavIndex(idx < 0 ? 0 : idx - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (active && active.hasAttribute("data-toggle-group")) {
        var keyR = active.getAttribute("data-toggle-group");
        if (!isExpanded(keyR) || isFilterActive()) {
          setExpanded(keyR, true);
          renderBrowse();
          var again = visibleNavItems().filter(function (el) {
            return el.getAttribute("data-toggle-group") === keyR;
          })[0];
          if (again) again.focus();
        }
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (active && active.hasAttribute("data-toggle-group")) {
        var keyL = active.getAttribute("data-toggle-group");
        if (isExpanded(keyL) && !isFilterActive()) {
          setExpanded(keyL, false);
          renderBrowse();
          var againL = visibleNavItems().filter(function (el) {
            return el.getAttribute("data-toggle-group") === keyL;
          })[0];
          if (againL) againL.focus();
        }
      } else if (active && active.hasAttribute("data-group-key")) {
        var gk = active.getAttribute("data-group-key");
        var toggle = visibleNavItems().filter(function (el) {
          return el.getAttribute("data-toggle-group") === gk;
        })[0];
        if (toggle) toggle.focus();
      }
    } else if (e.key === "Enter") {
      if (active && active.hasAttribute("data-open-slug")) {
        e.preventDefault();
        openSongBySlug(active.getAttribute("data-open-slug"), true, {
          groupKey: active.getAttribute("data-group-key"),
        });
      }
    }
  }

  function onRootClick(e) {
    var t = e.target.closest("[data-go-artists]");
    if (t) {
      e.preventDefault();
      if (api && typeof api.goArtists === "function") api.goArtists();
      return;
    }

    t = e.target.closest("[data-artist-slug]");
    if (t) {
      e.preventDefault();
      var aSlug = t.getAttribute("data-artist-slug");
      if (api && typeof api.goArtist === "function") api.goArtist(aSlug);
      return;
    }

    t = e.target.closest("#lb-mode-all");
    if (t) {
      e.preventDefault();
      if (api && typeof api.goIndex === "function") {
        api.goIndex(indexFiltersPayload());
      }
      return;
    }

    t = e.target.closest("#lb-mode-artists");
    if (t) {
      e.preventDefault();
      if (api && typeof api.goArtists === "function") api.goArtists();
      return;
    }

    t = e.target.closest("[data-layout-mode]");
    if (t) {
      var mode = t.getAttribute("data-layout-mode");
      if (LAYOUT_MODES.indexOf(mode) !== -1) {
        state.layoutMode = mode;
        storageSet(LAYOUT_KEY, mode);
        applyLayoutClass();
        renderBrowse();
        if (state.currentSlug) renderSongView(state.currentSlug);
      }
      return;
    }

    t = e.target.closest("[data-toggle-group]");
    if (t) {
      var key = t.getAttribute("data-toggle-group");
      if (!isFilterActive()) {
        setExpanded(key, !state.expanded[key]);
        renderBrowse();
      }
      return;
    }

    t = e.target.closest("[data-open-slug]");
    if (t) {
      openSongBySlug(t.getAttribute("data-open-slug"), true, {
        groupKey: t.getAttribute("data-group-key"),
      });
      return;
    }

    t = e.target.closest("[data-instrument]");
    if (t) {
      state.instrumentFilter = t.getAttribute("data-instrument");
      storageSet(INSTRUMENT_KEY, state.instrumentFilter);
      state.tuningFilter = "all";
      state.capoFilter = "all";
      renderBrowse();
      syncIndexUrl();
      return;
    }
    t = e.target.closest("[data-tuning]");
    if (t) {
      state.tuningFilter = t.getAttribute("data-tuning");
      renderBrowse();
      syncIndexUrl();
      return;
    }
    t = e.target.closest("[data-capo]");
    if (t) {
      state.capoFilter = t.getAttribute("data-capo");
      renderBrowse();
      syncIndexUrl();
      return;
    }
  }

  function bindShell() {
    root.addEventListener("click", onRootClick);
    els.listPane = $("#lb-pane-list", root);
    els.search = $("#lb-search", root);
    els.filters = $("#lb-filters", root);
    els.filtersPanel = $("#lb-filters-panel", root);
    els.filtersToggle = $("#lb-filters-toggle", root);
    els.sortSelect = $("#lb-sort", root);
    els.prefetch = $("#lb-prefetch", root);
    els.prefetchText = $("#lb-prefetch-text", root);
    els.status = $("#lb-status", root);
    els.list = $("#lb-list", root);
    els.song = $("#lb-song", root);
    els.stageToggle = $("#lb-stage-toggle", root);
    els.lockBtn = $("#lb-lock", root);
    els.notesMsg = $("#lb-notes-msg", root);
    els.settingsBtn = $("#lb-settings-btn", root);
    els.settingsMenu = $("#lb-settings-menu", root);
    els.fontLabel = $("#lb-font-label", root);
    els.modeAll = $("#lb-mode-all", root);
    els.modeArtists = $("#lb-mode-artists", root);
    els.barSearch = $("#lb-bar-search", root);
    els.accordionTools = $("#lb-accordion-tools", root);
    els.expandActions = $("#lb-accordion-tools .lb-accordion-tools__actions", root);

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
        syncIndexUrl();
      });
    }

    if (els.sortSelect) {
      try {
        els.sortSelect.value = state.sort;
      } catch (e) {
        /* ignore */
      }
      els.sortSelect.addEventListener("change", function () {
        state.sort = els.sortSelect.value || "artist";
        storageSet(SORT_KEY, state.sort);
        renderBrowse();
        syncIndexUrl();
      });
    }

    if (els.filtersToggle) {
      els.filtersToggle.addEventListener("click", function () {
        state.filtersOpen = !state.filtersOpen;
        storageSet(FILTERS_OPEN_KEY, state.filtersOpen ? "1" : "0");
        updateFiltersToggle();
      });
    }

    var expandAllBtn = $("#lb-expand-all", root);
    var collapseAllBtn = $("#lb-collapse-all", root);
    if (expandAllBtn) {
      expandAllBtn.addEventListener("click", function () {
        expandAll(groupSongs(sortedSongs()));
      });
    }
    if (collapseAllBtn) {
      collapseAllBtn.addEventListener("click", function () {
        collapseAll();
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
        syncIndexUrl();
      }
      if (e.target && e.target.id === "lb-notes-import") {
        var file = e.target.files && e.target.files[0];
        if (!file || !notesApi()) return;
        var reader = new FileReader();
        reader.onload = function () {
          try {
            var n = notesApi().importNotesJson(String(reader.result || ""));
            setNotesMsg(
              "Imported " + n + " note" + (n === 1 ? "" : "s"),
              "ok"
            );
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
        N.shareExport(exportNotesBundle()).catch(function () {
          setNotesMsg("Share canceled");
        });
        closeSettingsMenu();
      });
    }

    var orientSel = $("#lb-songbook-orientation", root);
    if (orientSel && api && typeof api.getOrientation === "function") {
      orientSel.value = api.getOrientation();
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

    if (els.lockBtn) {
      els.lockBtn.addEventListener("click", function () {
        if (api && typeof api.lock === "function") api.lock();
      });
    }

    if (notesApi()) {
      notesApi().onChange(function () {
        if (!state.currentSlug) renderBrowse();
      });
    }

    document.addEventListener("keydown", onGlobalKeydown);

    if (api && typeof api.onRouteChange === "function") {
      state.unsubRoute = api.onRouteChange(function (route) {
        applyRoute(route);
      });
    }

    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible" && state.currentSlug) {
        requestWakeLock();
      }
    });

    if (els.song) {
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
          if (!state.currentSlug || !e.changedTouches || !e.changedTouches[0])
            return;
          var dx = e.changedTouches[0].clientX - state.swipeStartX;
          var dy = e.changedTouches[0].clientY - state.swipeStartY;
          if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy)) return;
          if (dx < 0) {
            var n = neighborInGroup(state.currentSlug, 1);
            if (n) openSongBySlug(n, true, { replaceUrl: true });
          } else {
            var p = neighborInGroup(state.currentSlug, -1);
            if (p) openSongBySlug(p, true, { replaceUrl: true });
          }
        },
        { passive: true }
      );
    }
  }

  function mount(browseApi) {
    api = browseApi;
    loadPrefs();
    loadSongsMetaFallback();
    applyStageClass();

    if (chordsApi() && typeof chordsApi().onUnlock === "function") {
      chordsApi().onUnlock(api);
    }

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
    startPrefetch();

    var route =
      api && typeof api.parseRoute === "function" ? api.parseRoute() : null;
    if (route) {
      applyRoute(route);
    } else {
      var slug =
        api && typeof api.parseSongHash === "function"
          ? api.parseSongHash()
          : "";
      if (slug) openSongBySlug(slug, false);
      else renderBrowse();
    }
  }

  function unmount() {
    state.prefetchAbort = true;
    stopAutoScroll();
    releaseWakeLock();
    applyHasSongClass(false);
    state.chordsText = null;
    state.chordsLoading = false;
    state.currentDetails = null;
    if (typeof state.unsubRoute === "function") {
      try {
        state.unsubRoute();
      } catch (e) {
        /* ignore */
      }
      state.unsubRoute = null;
    }
    document.body.classList.remove(
      "lb-stage",
      "lb-layout-desktop",
      "lb-layout-touch",
      "lb-song-open"
    );
    document.removeEventListener("keydown", onGlobalKeydown);
    var browserEl = document.getElementById("lyrics-browser");
    if (browserEl) browserEl.classList.remove("lb-active");
    if (root) root.innerHTML = "";
    api = null;
    els = {};
    if (chordsApi() && typeof chordsApi().reset === "function") {
      chordsApi().reset();
    }
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
