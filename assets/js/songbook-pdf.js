(function (root) {
  "use strict";

  // Page geometry (points). Set per build by setGeometry(orientation).
  var ORIENTATION = "portrait";
  var MARGIN, PAGE, FOOTER_Y, HEADER_Y, CONTENT_TOP, CONTENT_BOTTOM, CONTENT_WIDTH;
  // Lyrics are set in two columns. Sizes are tried in order; the first that
  // fits the song on one page wins (else the first size is used).
  var LYRIC_SIZES;
  var COL_GAP = 24;

  function setGeometry(orientation) {
    ORIENTATION = orientation === "landscape" ? "landscape" : "portrait";
    PAGE =
      ORIENTATION === "landscape" ? { w: 792, h: 612 } : { w: 612, h: 792 };
    MARGIN = 36;
    HEADER_Y = 26;
    FOOTER_Y = PAGE.h - 16;
    CONTENT_TOP = 52;
    CONTENT_BOTTOM = PAGE.h - 34;
    CONTENT_WIDTH = PAGE.w - MARGIN * 2;
    LYRIC_SIZES =
      ORIENTATION === "landscape"
        ? [
            { size: 11.5, lineH: 15 },
            { size: 10.5, lineH: 13.5 },
            { size: 9.5, lineH: 12.25 },
          ]
        : [
            { size: 11, lineH: 14.25 },
            { size: 10, lineH: 13 },
            { size: 9.5, lineH: 12.25 },
          ];
  }
  setGeometry("portrait");

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
      bits.push(inst.tuning + (inst.unverified && !/\?$/.test(String(inst.tuning)) ? "?" : ""));
    }
    if (inst.capo != null && Number(inst.capo) !== 0) {
      bits.push("Capo " + Number(inst.capo));
    }
    if (!bits.length) return "";
    return inst.name + ": " + bits.join(" · ");
  }

  function abbreviateInstrument(name) {
    var n = normalizeInstrumentName(name);
    if (n === "Guitar") return "Gtr";
    if (n === "Octave mandolin") return "OM";
    if (n === "Banjo") return "Banjo";
    return n || "Gtr";
  }

  /** Compact muted setup for titles / TOC / headers. */
  function formatSetup(song) {
    if (
      root.LyricsSetup &&
      typeof root.LyricsSetup.formatSetupCompact === "function"
    ) {
      var compact = root.LyricsSetup.formatSetupCompact(
        Object.assign({}, song, { instruments: instrumentsForSong(song) })
      );
      if (compact) return compact;
    }
    var instruments = instrumentsForSong(song);
    if (instruments.length === 1) {
      var bits = [];
      var inst = instruments[0];
      if (inst.tuning) bits.push(inst.tuning + (inst.unverified && !/\?$/.test(String(inst.tuning)) ? "?" : ""));
      if (inst.capo != null && Number(inst.capo) !== 0) {
        bits.push("Capo " + Number(inst.capo));
      }
      return bits.join(" · ");
    }
    if (instruments.length > 1) {
      return instruments
        .map(function (row) {
          var parts = [];
          if (row.tuning) parts.push(row.tuning + (row.unverified && !/\?$/.test(String(row.tuning)) ? "?" : ""));
          if (row.capo != null && Number(row.capo) !== 0) {
            parts.push("Capo " + Number(row.capo));
          }
          if (!parts.length) return "";
          return abbreviateInstrument(row.name) + ": " + parts.join(" · ");
        })
        .filter(Boolean)
        .join(" · ");
    }
    var legacy = [];
    if (song.tuning) {
      var tuning = song.tuning;
      if (song.tuning_unverified) tuning += "?";
      legacy.push(tuning);
    }
    if (song.capo != null && Number(song.capo) !== 0) {
      legacy.push("Capo " + Number(song.capo));
    }
    return legacy.join(" · ");
  }

  function setupLines(song) {
    var text = formatSetup(song);
    if (!text) return [];
    // Compact form is one line; keep split for older multi-line callers
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

  function notesText(song) {
    var n = song && song.notes;
    if (n == null) return "";
    n = String(n).replace(/\r\n?/g, "\n").replace(/\s+$/, "");
    return n.trim() ? n : "";
  }

  function stanzasOf(body) {
    return String(body)
      .split(/\n[ \t]*\n+/)
      .map(function (st) {
        return st.replace(/^\n+|\n+$/g, "");
      })
      .filter(function (st) {
        return st.trim() !== "";
      });
  }

  /**
   * Lay out one song: header (title, artist, setup, notes) across the full
   * width, then lyrics in two columns, stanzas kept together when they fit.
   * With hooks it draws; without, it only measures. Returns { pages }.
   */
  function layoutSong(doc, song, size, hooks) {
    var draw = !!hooks;
    var setups = setupLines(song);
    var body = lyricsLines(song);
    var notes = notesText(song);
    var colW = (CONTENT_WIDTH - COL_GAP) / 2;
    var pages = 1;
    // Chord sheets (song.monospace): fixed-width font so chords stay over
    // their syllables; one full-width column when lines are too long for two.
    var mono = !!(song && song.monospace);
    var fontSize = mono ? Math.round(size.size * 80) / 100 : size.size;
    var lineH = mono ? Math.round(size.lineH * 85) / 100 : size.lineH;
    var single = false;
    if (mono && body) {
      var longest = 0;
      body.split("\n").forEach(function (l) {
        longest = Math.max(longest, l.replace(/\s+$/, "").length);
      });
      if (longest * 0.6 * fontSize > colW) {
        single = true;
        colW = CONTENT_WIDTH;
      }
    }

    function header(continued) {
      var yy = CONTENT_TOP;
      doc.setFont("times", "bold");
      doc.setFontSize(continued ? 13 : 18);
      if (draw) {
        doc.text(continued ? song.title + " (cont.)" : song.title, MARGIN, yy);
      }
      if (continued) return yy + 20;
      yy += 17;
      doc.setFont("times", "normal");
      doc.setFontSize(11);
      if (draw) doc.text(String(song.artist || ""), MARGIN, yy);
      yy += 14;
      if (song.retune) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        if (draw) {
          doc.setTextColor(170, 40, 20);
          doc.text(song.retune, MARGIN, yy);
          doc.setTextColor(0);
        }
        yy += 13;
      }
      if (setups.length) {
        var big = !!song.prominentSetup;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(big ? 13 : 9.5);
        setups.forEach(function (line) {
          if (draw) doc.text(big && song.setupLabel ? song.setupLabel + ": " + line : line, MARGIN, yy);
          yy += big ? 16 : 12;
        });
      }
      if (notes) {
        yy += 2;
        if (draw) {
          doc.setDrawColor(200);
          doc.setLineWidth(0.5);
          doc.line(MARGIN, yy - 8, PAGE.w - MARGIN, yy - 8);
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        if (draw) {
          doc.setTextColor(120);
          doc.text("NOTES", MARGIN, yy + 2);
        }
        yy += 11;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        var nl = doc.splitTextToSize(notes, CONTENT_WIDTH);
        var maxLines = Math.max(
          1,
          Math.floor(((CONTENT_BOTTOM - CONTENT_TOP) * 0.4) / 11.5)
        );
        if (nl.length > maxLines) {
          nl = nl.slice(0, maxLines);
          nl[maxLines - 1] = String(nl[maxLines - 1]).replace(/\s*$/, "") + " …";
        }
        if (draw) doc.setTextColor(60);
        nl.forEach(function (line) {
          if (draw) doc.text(line, MARGIN, yy);
          yy += 11.5;
        });
        if (draw) {
          doc.setTextColor(0);
          doc.line(MARGIN, yy - 5, PAGE.w - MARGIN, yy - 5);
        }
        yy += 4;
      }
      return yy + 12;
    }

    var colTop = header(false);
    if (!body) {
      if (draw) {
        doc.setFont("times", "italic");
        doc.setFontSize(12);
        doc.text("Instrumental / no lyrics", MARGIN, colTop);
      }
      return { pages: 1 };
    }

    function lyricFont() {
      doc.setFont(mono ? "courier" : "times", "normal");
      doc.setFontSize(fontSize);
    }
    lyricFont();
    var stanzas = stanzasOf(body).map(function (st) {
      return doc.splitTextToSize(st, colW);
    });
    var gap = Math.round(lineH * 0.55 * 100) / 100;
    var col = 0;
    var y = colTop;

    function nextColumn() {
      if (col === 0 && !single) {
        col = 1;
        y = colTop;
        return;
      }
      pages += 1;
      if (draw) hooks.newPage();
      colTop = header(true);
      col = 0;
      y = colTop;
      lyricFont();
    }

    stanzas.forEach(function (lines) {
      var h = lines.length * lineH;
      // Keep a stanza together: move it to a fresh column if it fits there.
      if (y > colTop && y + h > CONTENT_BOTTOM && h <= CONTENT_BOTTOM - colTop) {
        nextColumn();
      }
      lines.forEach(function (line) {
        if (y + lineH > CONTENT_BOTTOM) nextColumn();
        if (draw) doc.text(line, MARGIN + col * (colW + COL_GAP), y);
        y += lineH;
      });
      y += gap;
    });
    return { pages: pages };
  }

  /** Largest lyric size that fits the song on one page (else the default). */
  function pickSize(doc, song) {
    for (var i = 0; i < LYRIC_SIZES.length; i++) {
      if (layoutSong(doc, song, LYRIC_SIZES[i], null).pages === 1) {
        return LYRIC_SIZES[i];
      }
    }
    return LYRIC_SIZES[0];
  }

  function measureSongPages(doc, song) {
    return layoutSong(doc, song, pickSize(doc, song), null).pages;
  }

  /** "Both" mode: a song may carry song.chordsText, set right after its lyrics. */
  function chordPart(song) {
    if (!song || song.chordsText == null || !String(song.chordsText).trim()) return null;
    return Object.assign({}, song, {
      title: song.title + " (chords)",
      lyrics: String(song.chordsText),
      monospace: true,
      notes: null,
    });
  }

  /**
   * Extra sections from setlists marked for the songbook (_data/setlists.yaml,
   * songbook: true), in setlist order, each song re-rendered with only the
   * setlist's instrument and a "Retune" line wherever the tuning changes.
   */
  function readSections(options) {
    if (options && Array.isArray(options.sections)) return options.sections;
    try {
      var el = root.document && root.document.getElementById("songbook-sections-json");
      return el ? JSON.parse(el.textContent || "[]") : [];
    } catch (e) {
      return [];
    }
  }

  function tuningOf(song) {
    var inst = instrumentsForSong(song)[0];
    return inst && inst.tuning ? String(inst.tuning) : "";
  }

  function sectionSongs(section, list) {
    var byTitle = {};
    list.forEach(function (s) {
      if (!byTitle[s.title]) byTitle[s.title] = s;
    });
    var want = normalizeInstrumentName(section.instrument || "").toLowerCase();
    var prev = want === "guitar" ? "Standard (EADGBE)" : null;
    var out = [];
    (section.titles || []).forEach(function (title) {
      var song = byTitle[title];
      if (!song) return;
      var copy = Object.assign({}, song, { prominentSetup: true, retune: null });
      if (want) {
        copy.instrument = section.instrument;
        copy.setupLabel = normalizeInstrumentName(section.instrument);
        copy.instruments = (song.instruments || []).filter(function (i) {
          return i && normalizeInstrumentName(i.name).toLowerCase() === want;
        });
      }
      var t = tuningOf(copy);
      if (prev !== null && t && t !== prev) copy.retune = "Retune: " + prev + " > " + t;
      if (t) prev = t;
      out.push(copy);
    });
    return out;
  }

  /** Small tappable link at the top left, "Chords »" / "« Lyrics". */
  function drawJumpLink(doc, label, dest) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(20, 70, 160);
    doc.textWithLink(label, MARGIN, HEADER_Y, { pageNumber: dest });
    doc.setTextColor(0);
  }

  function estimateTocPages(doc, artists, songsByArtist) {
    var y = CONTENT_TOP + 26 + 28;
    var pages = 1;
    artists.forEach(function (artist) {
      var block = 18 + (songsByArtist[artist].length || 0) * 24 + 8;
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
    var doc = new JsPDF({
      unit: "pt",
      format: "letter",
      orientation: ORIENTATION === "landscape" ? "l" : "p",
      compress: true,
    });
    var list = sortedSongs(songs || []);
    var grouped = groupSongs(list);
    var artists = grouped.artists;
    var songsByArtist = grouped.songsByArtist;

    onProgress("Measuring layout…");
    var lyricPageCounts = list.map(function (song) {
      return measureSongPages(doc, song);
    });
    var chordPageCounts = list.map(function (song) {
      var part = chordPart(song);
      return part ? measureSongPages(doc, part) : 0;
    });

    var tocStart = 2;
    var firstSongPage = tocStart + tocPages;
    var songStartPage = {};
    var cursor = firstSongPage;
    list.forEach(function (song, i) {
      songStartPage[songKey(song)] = cursor;
      cursor += lyricPageCounts[i];
    });
    // "Both" mode: a Chords section after all the lyrics, same order.
    var chordStartPage = {};
    var chordsSectionPage = 0;
    if (chordPageCounts.some(Boolean)) {
      chordsSectionPage = cursor;
      cursor += 1;
      list.forEach(function (song, i) {
        if (!chordPageCounts[i]) return;
        chordStartPage[songKey(song)] = cursor;
        cursor += chordPageCounts[i];
      });
    }
    var sections = readSections(options)
      .map(function (sec) {
        return { name: String(sec.name || "Section"), songs: sectionSongs(sec, list) };
      })
      .filter(function (sec) {
        return sec.songs.length;
      });
    sections.forEach(function (sec) {
      sec.page = cursor;
      cursor += 1;
      sec.starts = sec.songs.map(function (song) {
        var at = cursor;
        cursor += measureSongPages(doc, song);
        return at;
      });
    });
    var totalPages = cursor - 1;
    var sectionLinks = [];
    if (chordsSectionPage) sectionLinks.push({ name: "Chords", page: chordsSectionPage });
    sections.forEach(function (sec) {
      sectionLinks.push({ name: sec.name, page: sec.page });
    });

    var letterDestPage = {};
    var letters = [];
    (function prewalk() {
      var py = CONTENT_TOP + 26 + 28 + (sectionLinks.length ? 16 : 0);
      var pp = tocStart;
      artists.forEach(function (artist) {
        var block = 18 + songsByArtist[artist].length * 24 + 8;
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
    if (sectionLinks.length) {
      // One row of section links under the letters.
      y += 16;
      lx = MARGIN;
      doc.setFontSize(10);
      doc.setTextColor(20, 70, 160);
      sectionLinks.forEach(function (sec) {
        var label = sec.name + " \u00bb";
        var w = doc.getTextWidth(label);
        if (lx + w > PAGE.w - MARGIN) {
          y += 13;
          lx = MARGIN;
        }
        doc.textWithLink(label, lx, y, { pageNumber: sec.page });
        lx += w + 16;
      });
      doc.setTextColor(0);
      doc.setFontSize(11);
    }
    y += 22;

    artists.forEach(function (artist) {
      if (y + 34 > CONTENT_BOTTOM) newTocPage();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(artist, MARGIN, y);
      y += 16;
      songsByArtist[artist].forEach(function (song) {
        if (y + 26 > CONTENT_BOTTOM) newTocPage();
        var dest = songStartPage[songKey(song)];
        var pageLabel = String(dest);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        var pw = doc.getTextWidth(pageLabel);
        var maxTitleW = CONTENT_WIDTH - pw - 16;
        if (chordPart(song)) {
          // Mark songs that have chords; the mark jumps to the chord page.
          doc.setFontSize(9);
          doc.setTextColor(20, 70, 160);
          var cw = doc.getTextWidth("chords");
          doc.textWithLink("chords", PAGE.w - MARGIN - pw - 8 - cw, y, {
            pageNumber: chordStartPage[songKey(song)],
          });
          doc.setTextColor(0);
          doc.setFontSize(11);
          maxTitleW -= cw + 8;
        }
        var titleLines = doc.splitTextToSize(song.title, maxTitleW);
        var line = titleLines[0];
        if (titleLines.length > 1) line = line.replace(/\s+$/, "") + "…";
        doc.textWithLink(line, MARGIN + 10, y, { pageNumber: dest });
        doc.text(pageLabel, PAGE.w - MARGIN - pw, y);
        y += 12;
        var setup = formatSetup(song);
        if (setup) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(110);
          var setupLine = doc.splitTextToSize(setup, maxTitleW)[0];
          doc.text(setupLine, MARGIN + 10, y);
          doc.setTextColor(0);
          y += 11;
        } else {
          y += 3;
        }
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

      var pageNum = start;
      var chordStart = chordStartPage[songKey(song)];
      var jump = chordStart
        ? function () { drawJumpLink(doc, "Chords \u00bb", chordStart); }
        : function () {};
      writeSong(song, function () { return pageNum; }, function (n) { pageNum = n; }, jump);
    });

    if (chordsSectionPage) {
      while (doc.getNumberOfPages() < chordsSectionPage) doc.addPage();
      doc.setPage(chordsSectionPage);
      drawIndexLink(doc, tocStart);
      doc.setFont("times", "bold");
      doc.setFontSize(36);
      doc.text("Chords", MARGIN, PAGE.h / 2 - 20);
      doc.setFont("times", "normal");
      doc.setFontSize(14);
      doc.text(Object.keys(chordStartPage).length + " songs", MARGIN, PAGE.h / 2 + 10);
      drawFooter(doc, chordsSectionPage, totalPages);
      var chordsOutline = doc.outline.add(null, "Chords", { pageNumber: chordsSectionPage });
      list.forEach(function (song, idx) {
        var cs = chordStartPage[songKey(song)];
        if (!cs) return;
        onProgress("Writing chords (" + (idx + 1) + "/" + list.length + ")…");
        var lyricsStart = songStartPage[songKey(song)];
        doc.outline.add(chordsOutline, song.title, { pageNumber: cs });
        var pageNum = cs;
        while (doc.getNumberOfPages() < cs) doc.addPage();
        doc.setPage(cs);
        writeSong(chordPart(song), function () { return pageNum; }, function (n) { pageNum = n; }, function () {
          drawJumpLink(doc, "\u00ab Lyrics", lyricsStart);
        });
      });
    }

    sections.forEach(function (sec) {
      while (doc.getNumberOfPages() < sec.page) doc.addPage();
      doc.setPage(sec.page);
      drawIndexLink(doc, tocStart);
      // Section title page doubles as its running order.
      var yy = CONTENT_TOP + 10;
      doc.setFont("times", "bold");
      doc.setFontSize(26);
      doc.text(sec.name, MARGIN, yy);
      yy += 26;
      var step = Math.min(15, (CONTENT_BOTTOM - yy) / sec.songs.length);
      var fs = Math.max(6.5, Math.min(10.5, step * 0.72));
      sec.songs.forEach(function (song, i) {
        var label = String(sec.starts[i]);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(fs);
        var pw = doc.getTextWidth(label);
        var setup = formatSetup(song);
        var line = i + 1 + ". " + song.title + " \u2014 " + song.artist;
        var setW = setup ? doc.getTextWidth(setup) + 12 : 0;
        line = doc.splitTextToSize(line, CONTENT_WIDTH - pw - setW - 12)[0];
        doc.textWithLink(line, MARGIN, yy, { pageNumber: sec.starts[i] });
        if (setup) {
          doc.setTextColor(110);
          doc.text(setup, PAGE.w - MARGIN - pw - setW, yy);
          doc.setTextColor(0);
        }
        doc.text(label, PAGE.w - MARGIN - pw, yy);
        yy += step;
      });
      drawFooter(doc, sec.page, totalPages);
      var node = doc.outline.add(null, sec.name, { pageNumber: sec.page });
      sec.songs.forEach(function (song, i) {
        onProgress(sec.name + " (" + (i + 1) + "/" + sec.songs.length + ")…");
        var at = sec.starts[i];
        doc.outline.add(node, song.title, { pageNumber: at });
        var pageNum = at;
        while (doc.getNumberOfPages() < at) doc.addPage();
        doc.setPage(at);
        var chordStart = chordStartPage[songKey(song)];
        writeSong(song, function () { return pageNum; }, function (n) { pageNum = n; }, chordStart
          ? function () { drawJumpLink(doc, "Chords \u00bb", chordStart); }
          : function () {});
      });
    });

    function writeSong(song, getPage, setPageNum, jump) {
      drawIndexLink(doc, tocStart);
      jump();
      layoutSong(doc, song, pickSize(doc, song), {
        newPage: function () {
          drawFooter(doc, getPage(), totalPages);
          setPageNum(getPage() + 1);
          while (doc.getNumberOfPages() < getPage()) doc.addPage();
          doc.setPage(getPage());
          drawIndexLink(doc, tocStart);
          jump();
        },
      });
      drawFooter(doc, getPage(), totalPages);
    }

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
      orientation: ORIENTATION,
      arrayBuffer: ab,
    };
  }

  function build(songs, options) {
    options = options || {};
    var JsPDF = getJsPDF();
    setGeometry(options.orientation);
    var probe = new JsPDF({
      unit: "pt",
      format: "letter",
      orientation: ORIENTATION === "landscape" ? "l" : "p",
    });
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
    measureSongPages: function (song, orientation) {
      setGeometry(orientation);
      var JsPDF = getJsPDF();
      var doc = new JsPDF({
        unit: "pt",
        format: "letter",
        orientation: ORIENTATION === "landscape" ? "l" : "p",
      });
      var size = pickSize(doc, song);
      return { pages: layoutSong(doc, song, size, null).pages, size: size.size };
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
