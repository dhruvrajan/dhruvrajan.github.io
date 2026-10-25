(function () {
  "use strict";

  var STORAGE_TOKEN = "genius_access_token";
  var STORAGE_RECENT = "genius_recent_searches";
  var STORAGE_FAVORITES = "genius_favorites";
  var API_BASE = "https://api.genius.com";
  var MAX_RECENT = 8;
  var MAX_FAVORITES = 24;

  var els = {
    tokenGate: document.getElementById("token-gate"),
    tokenForm: document.getElementById("token-form"),
    tokenInput: document.getElementById("token-input"),
    tokenStatus: document.getElementById("token-status"),
    changeToken: document.getElementById("change-token"),
    clearToken: document.getElementById("clear-token"),
    cancelToken: document.getElementById("cancel-token"),
    browser: document.getElementById("lyrics-browser"),
    searchForm: document.getElementById("search-form"),
    searchInput: document.getElementById("search-input"),
    status: document.getElementById("search-status"),
    results: document.getElementById("search-results"),
    detail: document.getElementById("song-detail"),
    recentList: document.getElementById("recent-list"),
    favoritesList: document.getElementById("favorites-list"),
  };

  function getToken() {
    try {
      return (localStorage.getItem(STORAGE_TOKEN) || "").trim();
    } catch (e) {
      return "";
    }
  }

  function setToken(token) {
    try {
      localStorage.setItem(STORAGE_TOKEN, token.trim());
    } catch (e) {
      throw new Error("Could not save the token in this browser (storage blocked).");
    }
  }

  function clearToken() {
    try {
      localStorage.removeItem(STORAGE_TOKEN);
    } catch (e) {
      /* ignore */
    }
  }

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* ignore quota / private mode */
    }
  }

  function setStatus(message, kind) {
    if (!els.status) return;
    els.status.textContent = message || "";
    els.status.className = "lyrics-status" + (kind ? " lyrics-status--" + kind : "");
    els.status.hidden = !message;
  }

  function showTokenGate(show) {
    if (els.tokenGate) els.tokenGate.hidden = !show;
    if (els.browser) els.browser.hidden = show;
    if (els.cancelToken) {
      // Only offer cancel when a token is already saved.
      els.cancelToken.hidden = !(show && getToken());
    }
  }

  function refreshChrome() {
    var token = getToken();
    showTokenGate(!token);
    if (els.tokenStatus) {
      els.tokenStatus.textContent = token
        ? "Token saved in this browser only."
        : "";
    }
    renderRecent();
    renderFavorites();
  }

  function isNetworkOrCorsFailure(err) {
    return !!(err && (err.name === "TypeError" || err instanceof TypeError));
  }

  /**
   * Genius allows Authorization in CORS preflight (Access-Control-Allow-Headers).
   * Prefer Bearer (documented). Fall back to access_token query param only when
   * the Authorization request fails with a network/CORS TypeError — never on
   * BAD_TOKEN / RATE_LIMIT / other API errors.
   *
   * Note: invalid-token 401 responses currently omit Access-Control-Allow-Origin,
   * so browsers surface them as TypeError rather than readable 401s. When both
   * Bearer and query fail that way, we raise CORS_OR_BAD_TOKEN.
   */
  async function geniusFetch(path, params) {
    var token = getToken();
    if (!token) {
      throw new Error("NO_TOKEN");
    }

    var qs = new URLSearchParams(params || {});
    var url = API_BASE + path + (qs.toString() ? "?" + qs.toString() : "");

    try {
      var res = await fetch(url, {
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/json",
        },
      });
      return await parseGeniusResponse(res);
    } catch (err) {
      if (!isNetworkOrCorsFailure(err)) {
        throw err;
      }

      // Retry with query-param auth (also documented by Genius).
      var qs2 = new URLSearchParams(params || {});
      qs2.set("access_token", token);
      var url2 = API_BASE + path + "?" + qs2.toString();
      try {
        var res2 = await fetch(url2, { headers: { Accept: "application/json" } });
        return await parseGeniusResponse(res2);
      } catch (err2) {
        if (isNetworkOrCorsFailure(err2)) {
          var cors = new Error("CORS_OR_BAD_TOKEN");
          cors.cause = err2;
          throw cors;
        }
        throw err2;
      }
    }
  }

  async function parseGeniusResponse(res) {
    var data = null;
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }

    if (res.status === 401 || (data && data.meta && data.meta.status === 401)) {
      var err = new Error("BAD_TOKEN");
      err.status = 401;
      throw err;
    }
    if (res.status === 429 || (data && data.meta && data.meta.status === 429)) {
      var err429 = new Error("RATE_LIMIT");
      err429.status = 429;
      throw err429;
    }
    if (!res.ok) {
      var msg =
        (data && data.meta && data.meta.message) ||
        (data && data.error_description) ||
        "Request failed (" + res.status + ").";
      var errOther = new Error(msg);
      errOther.status = res.status;
      throw errOther;
    }
    return data;
  }

  function humanError(err) {
    if (!err) return "Something went wrong.";
    if (err.message === "NO_TOKEN") return "Add a Genius access token to search.";
    if (err.message === "BAD_TOKEN")
      return "That token was rejected. Update it with “Change token”, or generate a new client access token at genius.com/api-clients.";
    if (err.message === "CORS_OR_BAD_TOKEN")
      return "Could not reach the Genius API from this browser (network/CORS), or the token may be invalid. Try “Change token”, generate a new client access token at genius.com/api-clients, then search again.";
    if (err.message === "RATE_LIMIT")
      return "Genius rate limit hit. Wait a minute and try again.";
    if (isNetworkOrCorsFailure(err))
      return "Could not reach the Genius API from this browser (network or CORS). Try again, or open the song on Genius directly.";
    return err.message || "Something went wrong.";
  }

  function hitToSong(hit) {
    var result = hit && hit.result ? hit.result : hit;
    if (!result) return null;
    return {
      id: result.id,
      title: result.title || result.title_with_featured || "Untitled",
      artist:
        (result.primary_artist && result.primary_artist.name) ||
        "Unknown artist",
      thumb:
        result.song_art_image_thumbnail_url ||
        result.header_image_thumbnail_url ||
        "",
      url: result.url || "https://genius.com/songs/" + result.id,
    };
  }

  function renderResults(hits) {
    if (!els.results) return;
    els.results.innerHTML = "";
    if (!hits || !hits.length) {
      els.results.innerHTML =
        '<p class="lyrics-empty">No songs matched that search.</p>';
      return;
    }

    var list = document.createElement("ul");
    list.className = "lyrics-results";
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", "Search results");

    hits.forEach(function (hit) {
      var song = hitToSong(hit);
      if (!song) return;
      var li = document.createElement("li");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "lyrics-result";
      btn.setAttribute("role", "option");
      btn.innerHTML =
        (song.thumb
          ? '<img class="lyrics-result__thumb" src="' +
            escapeAttr(song.thumb) +
            '" alt="" width="48" height="48" loading="lazy">'
          : '<span class="lyrics-result__thumb lyrics-result__thumb--empty" aria-hidden="true"></span>') +
        '<span class="lyrics-result__text">' +
        '<span class="lyrics-result__title">' +
        escapeHtml(song.title) +
        "</span>" +
        '<span class="lyrics-result__artist">' +
        escapeHtml(song.artist) +
        "</span>" +
        "</span>";
      btn.addEventListener("click", function () {
        openSong(song);
      });
      li.appendChild(btn);
      list.appendChild(li);
    });

    els.results.appendChild(list);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/'/g, "&#39;");
  }

  async function runSearch(query, opts) {
    opts = opts || {};
    var q = (query || "").trim();
    if (!q) {
      setStatus("Enter a song or artist name.", "info");
      return;
    }
    if (!getToken()) {
      showTokenGate(true);
      return;
    }

    setStatus("Searching…", "info");
    if (els.results) els.results.innerHTML = "";
    if (!opts.keepDetail && els.detail) {
      els.detail.hidden = true;
      els.detail.innerHTML = "";
    }

    try {
      var data = await geniusFetch("/search", { q: q });
      var hits = (data.response && data.response.hits) || [];
      setStatus(
        hits.length
          ? hits.length + " result" + (hits.length === 1 ? "" : "s")
          : "No results",
        hits.length ? "ok" : "info"
      );
      renderResults(hits);
      pushRecent(q);
      renderRecent();
    } catch (err) {
      setStatus(humanError(err), "error");
    }
  }

  function updateFavButton(song) {
    var favBtn = document.getElementById("fav-toggle");
    if (!favBtn || !song) return;
    favBtn.textContent = isFavorite(song.id) ? "Remove favorite" : "Save favorite";
  }

  function loadGeniusEmbed(songId, songUrl, songTitle) {
    var host = document.getElementById("genius-embed");
    if (!host) return;

    host.innerHTML =
      "<div id='rg_embed_link_" +
      songId +
      "' class='rg_embed_link' data-song-id='" +
      songId +
      "'>" +
      'Read <a href="' +
      escapeAttr(songUrl) +
      '" target="_blank" rel="noopener noreferrer">“' +
      escapeHtml(songTitle) +
      "” on Genius</a>" +
      "</div>";

    var script = document.createElement("script");
    script.src = "https://genius.com/songs/" + songId + "/embed.js";
    script.async = true;
    script.onerror = function () {
      /* Fallback link already in the embed host. */
    };
    host.appendChild(script);
  }

  async function openSong(song) {
    if (!song || !song.id || !els.detail) return;
    els.detail.hidden = false;
    els.detail.innerHTML =
      '<p class="lyrics-status lyrics-status--info">Loading song…</p>';
    els.detail.scrollIntoView({ behavior: "smooth", block: "start" });

    var meta = song;
    try {
      var data = await geniusFetch("/songs/" + song.id, {
        text_format: "plain",
      });
      if (data.response && data.response.song) {
        meta = hitToSong(data.response.song) || song;
      }
    } catch (err) {
      // Still show embed + link using search hit data.
      setStatus(humanError(err), "error");
    }

    var fav = isFavorite(meta.id);
    els.detail.innerHTML =
      '<div class="song-detail__header">' +
      (meta.thumb
        ? '<img class="song-detail__art" src="' +
          escapeAttr(meta.thumb) +
          '" alt="" width="96" height="96">'
        : "") +
      '<div class="song-detail__meta">' +
      '<h2 class="song-detail__title">' +
      escapeHtml(meta.title) +
      "</h2>" +
      '<p class="song-detail__artist">' +
      escapeHtml(meta.artist) +
      "</p>" +
      '<p class="song-detail__actions">' +
      '<a href="' +
      escapeAttr(meta.url) +
      '" target="_blank" rel="noopener noreferrer">Open on Genius</a>' +
      ' · <button type="button" class="linkish" id="fav-toggle">' +
      (fav ? "Remove favorite" : "Save favorite") +
      "</button>" +
      "</p>" +
      "</div></div>" +
      '<div class="song-detail__embed" id="genius-embed"></div>' +
      '<p class="item-meta">Lyrics are shown via Genius’s official embed. If the embed is blocked, use the link above.</p>';

    var favBtn = document.getElementById("fav-toggle");
    if (favBtn) {
      favBtn.addEventListener("click", function () {
        toggleFavorite(meta);
        updateFavButton(meta);
      });
    }

    loadGeniusEmbed(meta.id, meta.url, meta.title);
  }

  function pushRecent(query) {
    var q = query.trim();
    var items = readJson(STORAGE_RECENT, []).filter(function (item) {
      return item.toLowerCase() !== q.toLowerCase();
    });
    items.unshift(q);
    writeJson(STORAGE_RECENT, items.slice(0, MAX_RECENT));
  }

  function renderRecent() {
    if (!els.recentList) return;
    var items = readJson(STORAGE_RECENT, []);
    els.recentList.innerHTML = "";
    if (!items.length) {
      els.recentList.innerHTML = '<li class="item-meta">No recent searches yet.</li>';
      return;
    }
    items.forEach(function (q) {
      var li = document.createElement("li");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "linkish";
      btn.textContent = q;
      btn.addEventListener("click", function () {
        if (els.searchInput) els.searchInput.value = q;
        runSearch(q);
      });
      li.appendChild(btn);
      els.recentList.appendChild(li);
    });
  }

  function isFavorite(id) {
    return readJson(STORAGE_FAVORITES, []).some(function (s) {
      return String(s.id) === String(id);
    });
  }

  function toggleFavorite(song) {
    var items = readJson(STORAGE_FAVORITES, []);
    if (isFavorite(song.id)) {
      items = items.filter(function (s) {
        return String(s.id) !== String(song.id);
      });
    } else {
      items.unshift({
        id: song.id,
        title: song.title,
        artist: song.artist,
        thumb: song.thumb,
        url: song.url,
      });
      items = items.slice(0, MAX_FAVORITES);
    }
    writeJson(STORAGE_FAVORITES, items);
    renderFavorites();
  }

  function renderFavorites() {
    if (!els.favoritesList) return;
    var items = readJson(STORAGE_FAVORITES, []);
    els.favoritesList.innerHTML = "";
    if (!items.length) {
      els.favoritesList.innerHTML = '<li class="item-meta">No favorites yet.</li>';
      return;
    }
    items.forEach(function (song) {
      var li = document.createElement("li");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "linkish";
      btn.textContent = song.title + " — " + song.artist;
      btn.addEventListener("click", function () {
        openSong(song);
      });
      li.appendChild(btn);
      els.favoritesList.appendChild(li);
    });
  }

  function bind() {
    if (els.tokenForm) {
      els.tokenForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var token = (els.tokenInput.value || "").trim();
        if (!token) {
          els.tokenInput.focus();
          return;
        }
        try {
          setToken(token);
        } catch (err) {
          if (els.tokenStatus) {
            els.tokenStatus.textContent = humanError(err);
          }
          return;
        }
        els.tokenInput.value = "";
        refreshChrome();
        var pending = new URLSearchParams(window.location.search).get("q");
        if (pending && els.searchInput) {
          els.searchInput.value = pending;
          runSearch(pending);
        }
      });
    }

    if (els.changeToken) {
      els.changeToken.addEventListener("click", function () {
        showTokenGate(true);
        if (els.tokenInput) {
          els.tokenInput.value = "";
          els.tokenInput.focus();
        }
      });
    }

    if (els.cancelToken) {
      els.cancelToken.addEventListener("click", function () {
        if (getToken()) {
          showTokenGate(false);
          if (els.tokenStatus) {
            els.tokenStatus.textContent = "Token saved in this browser only.";
          }
        }
      });
    }

    if (els.clearToken) {
      els.clearToken.addEventListener("click", function () {
        if (window.confirm("Clear the saved Genius token from this browser?")) {
          clearToken();
          if (els.results) els.results.innerHTML = "";
          if (els.detail) {
            els.detail.hidden = true;
            els.detail.innerHTML = "";
          }
          setStatus("");
          refreshChrome();
        }
      });
    }

    if (els.searchForm) {
      els.searchForm.addEventListener("submit", function (e) {
        e.preventDefault();
        runSearch(els.searchInput ? els.searchInput.value : "");
      });
    }
  }

  function init() {
    bind();
    refreshChrome();

    var params = new URLSearchParams(window.location.search);
    var q = params.get("q");
    if (q && els.searchInput) {
      els.searchInput.value = q;
      if (getToken()) {
        runSearch(q);
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
