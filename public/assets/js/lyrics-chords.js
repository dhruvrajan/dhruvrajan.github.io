/* Chord sheets (encrypted under assets/data/chords/) for songbook PDF and
 * the per-song Lyrics | Chords view toggle. Chord plaintext stays in memory only. */
(function () {
  "use strict";

  var SONGBOOK_STORAGE = "lyrics_songbook_content_v1";
  var VIEW_STORAGE = "lyrics_song_content_view_v1";
  var CONCURRENCY = 6;
  var index = null; // { slug: true } or null before load
  var indexPromise = null;
  var cache = Object.create(null);
  var apiRef = null;

  function getSongbookMode() {
    try {
      var m = localStorage.getItem(SONGBOOK_STORAGE);
      return m === "chords" || m === "both" ? m : "lyrics";
    } catch (e) {
      return "lyrics";
    }
  }

  function setSongbookMode(mode) {
    try {
      localStorage.setItem(SONGBOOK_STORAGE, mode);
    } catch (e) {
      /* ignore */
    }
    syncSongbookButtons();
  }

  function getSongView() {
    try {
      var m = localStorage.getItem(VIEW_STORAGE);
      return m === "chords" ? "chords" : "lyrics";
    } catch (e) {
      return "lyrics";
    }
  }

  function setSongView(mode) {
    var v = mode === "chords" ? "chords" : "lyrics";
    try {
      localStorage.setItem(VIEW_STORAGE, v);
    } catch (e) {
      /* ignore */
    }
    return v;
  }

  function chordsBase() {
    var b =
      (document.body && document.body.getAttribute("data-lyrics-base")) ||
      "/assets/data/lyrics/";
    return b.replace(/\/?$/, "/").replace(/lyrics\/$/, "chords/");
  }

  function api() {
    return (
      apiRef ||
      (window.LyricsApp && typeof window.LyricsApp.browseApi === "function"
        ? window.LyricsApp.browseApi()
        : null)
    );
  }

  function reset() {
    index = null;
    indexPromise = null;
    cache = Object.create(null);
    apiRef = null;
  }

  async function ensureIndex(a) {
    if (index) return index;
    if (indexPromise) return indexPromise;
    var client = a || api();
    if (!client || typeof client.decryptJson !== "function") {
      index = Object.create(null);
      return index;
    }
    indexPromise = client
      .decryptJson(chordsBase() + "index.enc.json")
      .then(function (list) {
        index = Object.create(null);
        (Array.isArray(list) ? list : []).forEach(function (e) {
          if (e && e.slug) index[e.slug] = true;
        });
        return index;
      })
      .catch(function (err) {
        indexPromise = null;
        if (client.isAccessError && client.isAccessError(err)) throw err;
        index = Object.create(null);
        return index;
      });
    return indexPromise;
  }

  function hasChord(slug) {
    return !!(index && slug && index[slug]);
  }

  async function loadSheet(slug, a) {
    if (!slug) return null;
    if (cache[slug]) return cache[slug];
    var client = a || api();
    if (!client || typeof client.decryptJson !== "function") return null;
    var idx = await ensureIndex(client);
    if (!idx[slug]) return null;
    try {
      var p = await client.decryptJson(
        chordsBase() + "songs/" + encodeURIComponent(slug) + ".enc.json"
      );
      cache[slug] = p;
      return p;
    } catch (e) {
      if (client.isAccessError && client.isAccessError(e)) throw e;
      return null;
    }
  }

  function extractChordsText(sheet) {
    if (!sheet || sheet.chords_text == null) return null;
    var s = String(sheet.chords_text);
    return s.trim() ? s : null;
  }

  async function withChords(songs, both) {
    var a = api();
    if (!a || typeof a.decryptJson !== "function") return songs;
    var idx;
    try {
      idx = await ensureIndex(a);
    } catch (e) {
      return songs;
    }
    var out = songs.slice();
    var todo = [];
    out.forEach(function (s, i) {
      var slug = s && (s.slug || (a.songSlug && a.songSlug(s)));
      if (slug && idx[slug]) todo.push([i, slug]);
    });
    var next = 0;
    async function run() {
      while (next < todo.length) {
        var job = todo[next++];
        try {
          var sheet = await loadSheet(job[1], a);
          var text = extractChordsText(sheet);
          if (text) {
            out[job[0]] = Object.assign(
              {},
              out[job[0]],
              both
                ? { chordsText: text }
                : { lyrics: text, monospace: true, chordSheet: true }
            );
          }
        } catch (e) {
          /* keep lyrics for this song */
        }
      }
    }
    var workers = [];
    for (var w = 0; w < CONCURRENCY; w++) workers.push(run());
    await Promise.all(workers);
    return out;
  }

  function wrapBuild() {
    var pdf = window.DhruvSongbookPdf;
    if (!pdf || pdf.__chordsWrapped) return;
    var original = pdf.build;
    pdf.build = function (songs, options) {
      var mode = getSongbookMode();
      if (mode === "lyrics") return original.call(pdf, songs, options);
      if (options && options.onProgress) options.onProgress("Adding chord sheets…");
      return withChords(songs || [], mode === "both").then(function (list) {
        return original.call(pdf, list, options);
      });
    };
    pdf.__chordsWrapped = true;
  }

  function controlHtml(cls) {
    return (
      '<div class="' +
      cls +
      '" role="group" aria-label="Songbook content">' +
      '<button type="button" class="lb-btn lb-btn--subtle" data-songbook-content="lyrics">Lyrics</button>' +
      '<button type="button" class="lb-btn lb-btn--subtle" data-songbook-content="chords">Chords</button>' +
      '<button type="button" class="lb-btn lb-btn--subtle" data-songbook-content="both">Both</button>' +
      "</div>"
    );
  }

  function syncSongbookButtons() {
    var mode = getSongbookMode();
    document.querySelectorAll("[data-songbook-content]").forEach(function (b) {
      b.setAttribute(
        "aria-pressed",
        b.getAttribute("data-songbook-content") === mode ? "true" : "false"
      );
    });
  }

  function bindControl(el) {
    el.addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-songbook-content]");
      if (!b) return;
      ev.preventDefault();
      ev.stopPropagation();
      setSongbookMode(b.getAttribute("data-songbook-content"));
    });
  }

  function injectMenu() {
    var item = document.getElementById("lb-menu-songbook");
    if (!item || document.getElementById("lb-songbook-content")) return;
    var section = document.createElement("div");
    section.className = "lb-menu__section";
    section.id = "lb-songbook-content";
    section.innerHTML =
      '<p class="lb-menu__label">Songbook</p>' + controlHtml("lb-menu__row");
    var host = item.closest(".lb-menu__section");
    if (host && host.parentNode) host.parentNode.insertBefore(section, host);
    bindControl(section);
    syncSongbookButtons();
  }

  function injectToolbar() {
    var btn = document.getElementById("download-songbook-btn");
    if (!btn || document.getElementById("songbook-content-legacy")) return;
    var wrap = document.createElement("span");
    wrap.id = "songbook-content-legacy";
    wrap.innerHTML = controlHtml("lb-menu__row songbook-content");
    btn.parentNode.insertBefore(wrap, btn);
    bindControl(wrap);
    syncSongbookButtons();
  }

  function onUnlock(browseApi) {
    apiRef = browseApi || null;
    ensureIndex(apiRef).catch(function () {
      /* index optional until a song with chords is opened */
    });
  }

  function init() {
    wrapBuild();
    injectToolbar();
    injectMenu();
    new MutationObserver(function () {
      injectMenu();
    }).observe(document.body, { childList: true, subtree: true });
  }

  window.LyricsChords = {
    reset: reset,
    onUnlock: onUnlock,
    ensureIndex: ensureIndex,
    hasChord: hasChord,
    loadSheet: loadSheet,
    extractChordsText: extractChordsText,
    getSongView: getSongView,
    setSongView: setSongView,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
