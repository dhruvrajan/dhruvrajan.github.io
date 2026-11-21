/* Songbook content option: "Lyrics" (default), "Chords" or "Both".
 * With Chords, each song uses its encrypted chord sheet (assets/data/chords/)
 * when one exists and falls back to its lyrics otherwise. With Both, songs
 * with a chord sheet get it right after their lyrics, linked both ways
 * (songbook-pdf.js reads song.chordsText). Chord sheets are
 * rendered monospace so chords stay aligned above the lyric lines.
 * Isolated: wraps DhruvSongbookPdf.build and adds one control to the menu. */
(function () {
  "use strict";

  var STORAGE = "lyrics_songbook_content_v1";
  var CONCURRENCY = 6;
  var index = null; // { slug: true }
  var cache = Object.create(null);

  function getMode() {
    try {
      var m = localStorage.getItem(STORAGE);
      return m === "chords" || m === "both" ? m : "lyrics";
    } catch (e) {
      return "lyrics";
    }
  }

  function setMode(mode) {
    try {
      localStorage.setItem(STORAGE, mode);
    } catch (e) {
      /* ignore */
    }
    syncButtons();
  }

  function chordsBase() {
    var b = (document.body && document.body.getAttribute("data-lyrics-base")) || "/assets/data/lyrics/";
    return b.replace(/\/?$/, "/").replace(/lyrics\/$/, "chords/");
  }

  function api() {
    return window.LyricsApp && typeof window.LyricsApp.browseApi === "function"
      ? window.LyricsApp.browseApi()
      : null;
  }

  async function loadIndex(a) {
    if (index) return index;
    var list = await a.decryptJson(chordsBase() + "index.enc.json");
    index = Object.create(null);
    (Array.isArray(list) ? list : []).forEach(function (e) {
      if (e && e.slug) index[e.slug] = true;
    });
    return index;
  }

  async function loadSheet(a, slug) {
    if (cache[slug]) return cache[slug];
    var p = await a.decryptJson(chordsBase() + "songs/" + encodeURIComponent(slug) + ".enc.json");
    cache[slug] = p;
    return p;
  }

  async function withChords(songs, both) {
    var a = api();
    if (!a || typeof a.decryptJson !== "function") return songs;
    var idx;
    try {
      idx = await loadIndex(a);
    } catch (e) {
      return songs; // no chord sheets published: plain lyrics songbook
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
          var sheet = await loadSheet(a, job[1]);
          if (sheet && sheet.chords_text && String(sheet.chords_text).trim()) {
            out[job[0]] = Object.assign(
              {},
              out[job[0]],
              both
                ? { chordsText: String(sheet.chords_text) }
                : { lyrics: String(sheet.chords_text), monospace: true, chordSheet: true }
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
      var mode = getMode();
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
      '<div class="' + cls + '" role="group" aria-label="Songbook content">' +
      '<button type="button" class="lb-btn lb-btn--subtle" data-songbook-content="lyrics">Lyrics</button>' +
      '<button type="button" class="lb-btn lb-btn--subtle" data-songbook-content="chords">Chords</button>' +
      '<button type="button" class="lb-btn lb-btn--subtle" data-songbook-content="both">Both</button>' +
      "</div>"
    );
  }

  function syncButtons() {
    var mode = getMode();
    document.querySelectorAll("[data-songbook-content]").forEach(function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-songbook-content") === mode ? "true" : "false");
    });
  }

  function bindControl(el) {
    el.addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-songbook-content]");
      if (!b) return;
      ev.preventDefault();
      ev.stopPropagation();
      setMode(b.getAttribute("data-songbook-content"));
    });
  }

  function injectMenu() {
    var item = document.getElementById("lb-menu-songbook");
    if (!item || document.getElementById("lb-songbook-content")) return;
    var section = document.createElement("div");
    section.className = "lb-menu__section";
    section.id = "lb-songbook-content";
    section.innerHTML = '<p class="lb-menu__label">Songbook</p>' + controlHtml("lb-menu__row");
    var host = item.closest(".lb-menu__section");
    if (host && host.parentNode) host.parentNode.insertBefore(section, host);
    bindControl(section);
    syncButtons();
  }

  function injectToolbar() {
    var btn = document.getElementById("download-songbook-btn");
    if (!btn || document.getElementById("songbook-content-legacy")) return;
    var wrap = document.createElement("span");
    wrap.id = "songbook-content-legacy";
    wrap.innerHTML = controlHtml("lb-menu__row songbook-content");
    btn.parentNode.insertBefore(wrap, btn);
    bindControl(wrap);
    syncButtons();
  }

  function init() {
    wrapBuild();
    injectToolbar();
    injectMenu();
    new MutationObserver(function () {
      injectMenu();
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
