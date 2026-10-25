(function (root) {
  "use strict";

  var MARGIN = 54;
  var PAGE = { w: 612, h: 792 };
  var FOOTER_Y = PAGE.h - 28;
  var HEADER_Y = 36;
  var CONTENT_TOP = 72;
  var CONTENT_BOTTOM = PAGE.h - 54;
  var CONTENT_WIDTH = PAGE.w - MARGIN * 2;

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function todayStamp(d) {
    d = d || new Date();
    return (
      d.getFullYear() +
      "-" +
      pad2(d.getMonth() + 1) +
      "-" +
      pad2(d.getDate())
    );
  }

  function getJsPDF() {
    var ns = root.jspdf || root.jsPDF;
    if (ns && ns.jsPDF) return ns.jsPDF;
    if (typeof root.jsPDF === "function") return root.jsPDF;
    throw new Error("jsPDF library failed to load.");
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
      return String(a.title).localeCompare(String(b.title));
    });
  }

  function songKey(song) {
    return song.slug || song.title + "|" + song.artist;
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

  function instrumentsForSong(song) {
    var list = [];
    if (song && Array.isArray(song.instruments)) {
      song.instruments.forEach(function (inst) {
        if (!inst) return;
        var entry = {
          name: normalizeInstrumentName(inst.name) || "Guitar",
          tuning: inst.tuning,
          capo: inst.capo,
          unverified: !!(inst.unverified || inst.tuning_unverified),
        };
        if (entry.tuning || (entry.capo != null && entry.capo !== "")) {
          list.push(entry);
        }
      });
    }
    if (!list.length && song && (song.tuning || song.capo != null)) {
      list.push({
        name: normalizeInstrumentName(song.instrument) || "Guitar",
        tuning: song.tuning,
        capo: song.capo,
        unverified: !!(song.tuning_unverified || song.unverified),
      });
    }
    var preferred = normalizeInstrumentName(song && song.instrument);
    if (preferred) {
      var head = [];
      var rest = [];
      list.forEach(function (inst) {
        if (String(inst.name).toLowerCase() === preferred.toLowerCase())
          head.push(inst);
        else rest.push(inst);
      });
      list = head.concat(rest);
    }
    return list;
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

  function formatSetup(song) {
    var instruments = instrumentsForSong(song);
    if (instruments.length) {
      return instruments.map(formatInstrumentLine).filter(Boolean).join("\n");
    }
    var parts = [];
    if (song.tuning) {
      var tuning = song.tuning;
      if (song.tuning_unverified) tuning += "?";
      parts.push("Tuning: " + tuning);
    }
    if (song.capo != null && Number(song.capo) !== 0) {
      parts.push("Capo " + Number(song.capo));
    }
    return parts.join(" · ");
  }

  function setupLines(song) {
    var text = formatSetup(song);
    if (!text) return [];
    return String(text).split("\n").filter(Boolean);
  }

  function lyricsLines(song) {
    if (song.lyrics == null || String(song.lyrics).trim() === "") return null;
    return String(song.lyrics).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  }

  function letterOf(artist) {
    var ch = String(artist || "")
      .replace(/^(the|a|an)\s+/i, "")
      .charAt(0)
      .toUpperCase();
    if (ch >= "A" && ch <= "Z") return ch;
    return "#";
  }

  function measureSongPages(doc, song) {
    var setups = setupLines(song);
    var body = lyricsLines(song);
    var y = CONTENT_TOP + 26 + 18;
    if (setups.length) y += setups.length * 16;
    y += 10;
    if (!body) return 1;
    doc.setFont("times", "normal");
    doc.setFontSize(16);
    var lineH = 22;
    var wrapped = doc.splitTextToSize(body, CONTENT_WIDTH);
    var pages = 1;
    for (var i = 0; i < wrapped.length; i++) {
      if (y + lineH > CONTENT_BOTTOM) {
        pages += 1;
        y = CONTENT_TOP + 20;
      }
      y += lineH;
    }
    return pages;
  }

  function estimateTocPages(doc, artists, songsByArtist) {
    var y = CONTENT_TOP + 26 + 28;
    var pages = 1;
    artists.forEach(function (artist) {
      var block = 18 + (songsByArtist[artist].length || 0) * 15 + 8;
      if (y + 40 > CONTENT_BOTTOM) {
        pages += 1;
        y = CONTENT_TOP + 28;
      }
      y += block;
      while (y > CONTENT_BOTTOM) {
        pages += 1;
        y = CONTENT_TOP + 28 + (y - CONTENT_BOTTOM);
      }
    });
    return Math.max(1, pages);
  }

  function drawFooter(doc, pageNum, totalPages) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80);
    var label = String(pageNum) + " / " + String(totalPages);
    var w = doc.getTextWidth(label);
    doc.text(label, (PAGE.w - w) / 2, FOOTER_Y);
    doc.setTextColor(0);
  }

  function drawIndexLink(doc, tocPage) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(40);
    var label = "Index";
    var w = doc.getTextWidth(label);
    doc.textWithLink(label, PAGE.w - MARGIN - w, HEADER_Y, {
      pageNumber: tocPage,
    });
    doc.setTextColor(0);
  }

  function groupSongs(list) {
    var artists = uniqueArtists(list);
    var songsByArtist = {};
    artists.forEach(function (a) {
      songsByArtist[a] = [];
    });
    list.forEach(function (s) {
      songsByArtist[s.artist].push(s);
    });
    return { artists: artists, songsByArtist: songsByArtist };
  }

  function buildWithTocPages(songs, tocPages, options) {
    options = options || {};
    var onProgress = options.onProgress || function () {};
    var JsPDF = getJsPDF();
    var doc = new JsPDF({ unit: "pt", format: "letter", compress: true });
    var list = sortedSongs(songs || []);
    var grouped = groupSongs(list);
    var artists = grouped.artists;
    var songsByArtist = grouped.songsByArtist;

    onProgress("Measuring layout…");
    var songPageCounts = list.map(function (song) {
      return measureSongPages(doc, song);
    });

    var tocStart = 2;
    var firstSongPage = tocStart + tocPages;
    var songStartPage = {};
    var cursor = firstSongPage;
    list.forEach(function (song, i) {
      songStartPage[songKey(song)] = cursor;
      cursor += songPageCounts[i];
    });
    var totalPages = cursor - 1;

    var letterDestPage = {};
    var letters = [];
    (function prewalk() {
      var py = CONTENT_TOP + 26 + 28;
      var pp = tocStart;
      artists.forEach(function (artist) {
        var block = 18 + songsByArtist[artist].length * 15 + 8;
        if (py + 40 > CONTENT_BOTTOM) {
          pp += 1;
          py = CONTENT_TOP + 28;
        }
        var L = letterOf(artist);
        if (!letterDestPage[L]) {
          letterDestPage[L] = pp;
          letters.push(L);
        }
        py += block;
        while (py > CONTENT_BOTTOM) {
          pp += 1;
          py = CONTENT_TOP + 28 + (py - CONTENT_BOTTOM);
        }
      });
    })();
    letters.sort(function (a, b) {
      if (a === "#") return 1;
      if (b === "#") return -1;
      return a.localeCompare(b);
    });

    // Title page
    doc.setFont("times", "bold");
    doc.setFontSize(36);
    doc.text("Songbook", MARGIN, 300);
    doc.setFont("times", "normal");
    doc.setFontSize(14);
    doc.text(list.length + " songs", MARGIN, 330);
    doc.text(todayStamp(), MARGIN, 352);
    drawFooter(doc, 1, totalPages);

    onProgress("Building table of contents…");
    var tocPage = tocStart;
    doc.addPage();
    var y = CONTENT_TOP;

    function newTocPage() {
      drawFooter(doc, tocPage, totalPages);
      tocPage += 1;
      doc.addPage();
      y = CONTENT_TOP;
      doc.setFont("times", "bold");
      doc.setFontSize(22);
      doc.text("Contents (cont.)", MARGIN, y);
      y += 28;
    }

    doc.setFont("times", "bold");
    doc.setFontSize(22);
    doc.text("Contents", MARGIN, y);
    y += 26;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    var lx = MARGIN;
    letters.forEach(function (L) {
      var w = doc.getTextWidth(L);
      doc.textWithLink(L, lx, y, {
        pageNumber: letterDestPage[L] || tocStart,
      });
      lx += w + 10;
      if (lx > PAGE.w - MARGIN - 12) {
        y += 14;
        lx = MARGIN;
      }
    });
    y += 22;

    artists.forEach(function (artist) {
      if (y + 34 > CONTENT_BOTTOM) newTocPage();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(artist, MARGIN, y);
      y += 16;
      songsByArtist[artist].forEach(function (song) {
        if (y + 16 > CONTENT_BOTTOM) newTocPage();
        var dest = songStartPage[songKey(song)];
        var pageLabel = String(dest);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        var pw = doc.getTextWidth(pageLabel);
        var maxTitleW = CONTENT_WIDTH - pw - 16;
        var titleLines = doc.splitTextToSize(song.title, maxTitleW);
        var line = titleLines[0];
        if (titleLines.length > 1) line = line.replace(/\s+$/, "") + "…";
        doc.textWithLink(line, MARGIN + 10, y, { pageNumber: dest });
        doc.text(pageLabel, PAGE.w - MARGIN - pw, y);
        y += 15;
      });
      y += 8;
    });
    drawFooter(doc, tocPage, totalPages);

    var tocCountActual = tocPage - tocStart + 1;
    if (tocCountActual !== tocPages && (options._tocRetries || 0) < 4) {
      return buildWithTocPages(
        songs,
        tocCountActual,
        Object.assign({}, options, {
          _tocRetries: (options._tocRetries || 0) + 1,
        })
      );
    }

    while (doc.getNumberOfPages() < firstSongPage - 1) {
      doc.addPage();
      drawFooter(doc, doc.getNumberOfPages(), totalPages);
    }

    onProgress("Writing songs…");
    var artistOutlineNodes = {};
    artists.forEach(function (artist) {
      var firstSong = songsByArtist[artist][0];
      artistOutlineNodes[artist] = doc.outline.add(null, artist, {
        pageNumber: songStartPage[songKey(firstSong)],
      });
    });

    list.forEach(function (song, idx) {
      onProgress("Writing songs (" + (idx + 1) + "/" + list.length + ")…");
      var start = songStartPage[songKey(song)];
      while (doc.getNumberOfPages() < start) doc.addPage();
      doc.setPage(start);

      doc.outline.add(artistOutlineNodes[song.artist], song.title, {
        pageNumber: start,
      });

      var setups = setupLines(song);
      var body = lyricsLines(song);
      var pageNum = start;
      var first = true;

      function startSongPage(continued) {
        if (!first) {
          drawFooter(doc, pageNum, totalPages);
          pageNum += 1;
          while (doc.getNumberOfPages() < pageNum) doc.addPage();
          doc.setPage(pageNum);
        }
        first = false;
        drawIndexLink(doc, tocStart);
        var yy = CONTENT_TOP;
        doc.setFont("times", "bold");
        doc.setFontSize(continued ? 16 : 22);
        doc.text(
          continued ? song.title + " (cont.)" : song.title,
          MARGIN,
          yy
        );
        yy += continued ? 20 : 26;
        if (!continued) {
          doc.setFont("times", "normal");
          doc.setFontSize(13);
          doc.text(String(song.artist || ""), MARGIN, yy);
          yy += 18;
          if (setups.length) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            setups.forEach(function (line) {
              doc.text(line, MARGIN, yy);
              yy += 16;
            });
          }
        }
        yy += 8;
        return yy;
      }

      var yPos = startSongPage(false);
      if (!body) {
        doc.setFont("times", "italic");
        doc.setFontSize(14);
        doc.text("Instrumental / no lyrics", MARGIN, yPos);
        drawFooter(doc, pageNum, totalPages);
        return;
      }

      doc.setFont("times", "normal");
      doc.setFontSize(16);
      var lineH = 22;
      var wrapped = doc.splitTextToSize(body, CONTENT_WIDTH);
      for (var li = 0; li < wrapped.length; li++) {
        if (yPos + lineH > CONTENT_BOTTOM) {
          yPos = startSongPage(true);
          doc.setFont("times", "normal");
          doc.setFontSize(16);
        }
        doc.text(wrapped[li], MARGIN, yPos);
        yPos += lineH;
      }
      drawFooter(doc, pageNum, totalPages);
    });

    onProgress("Saving PDF…");
    var filename = "dhruv-songbook-" + todayStamp() + ".pdf";
    var ab = doc.output("arraybuffer");
    if (!options.returnBytes && typeof doc.save === "function") {
      doc.save(filename);
    }
    return {
      filename: filename,
      pages: doc.getNumberOfPages(),
      songs: list.length,
      tocPage: tocStart,
      arrayBuffer: ab,
    };
  }

  function build(songs, options) {
    options = options || {};
    var JsPDF = getJsPDF();
    var probe = new JsPDF({ unit: "pt", format: "letter" });
    var list = sortedSongs(songs || []);
    var grouped = groupSongs(list);
    var tocPages = estimateTocPages(
      probe,
      grouped.artists,
      grouped.songsByArtist
    );
    return buildWithTocPages(songs, tocPages, options);
  }

  root.DhruvSongbookPdf = {
    build: build,
    todayStamp: todayStamp,
    formatSetup: formatSetup,
  };
})(typeof window !== "undefined" ? window : globalThis);
