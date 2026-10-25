(function () {
  var input = document.getElementById("songs-filter-input");
  var status = document.getElementById("songs-filter-status");
  var jump = document.getElementById("songs-jump-nav");
  if (!input) return;

  var groups = Array.prototype.slice.call(
    document.querySelectorAll("#songs-by-artist .artist-group")
  );
  var jumpLinks = jump
    ? Array.prototype.slice.call(jump.querySelectorAll("a[data-artist]"))
    : [];

  function normalize(s) {
    return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function applyFilter() {
    var q = normalize(input.value);
    var visibleSongs = 0;
    var visibleArtists = 0;

    groups.forEach(function (group) {
      var artist = normalize(group.getAttribute("data-artist"));
      var items = group.querySelectorAll(".song-item");
      var groupVisible = 0;

      Array.prototype.forEach.call(items, function (item) {
        var title = normalize(item.getAttribute("data-title"));
        var songArtist = normalize(item.getAttribute("data-artist"));
        var match =
          !q ||
          title.indexOf(q) !== -1 ||
          songArtist.indexOf(q) !== -1 ||
          artist.indexOf(q) !== -1;
        item.hidden = !match;
        if (match) groupVisible += 1;
      });

      group.hidden = groupVisible === 0;
      if (groupVisible > 0) {
        visibleArtists += 1;
        visibleSongs += groupVisible;
      }

      var artistKey = group.getAttribute("data-artist");
      jumpLinks.forEach(function (link) {
        if (link.getAttribute("data-artist") === artistKey) {
          link.hidden = groupVisible === 0;
        }
      });
    });

    if (!status) return;
    if (!q) {
      status.textContent = "";
      return;
    }
    status.textContent =
      visibleSongs === 0
        ? "No matching songs."
        : visibleSongs +
          " song" +
          (visibleSongs === 1 ? "" : "s") +
          " · " +
          visibleArtists +
          " artist" +
          (visibleArtists === 1 ? "" : "s");
  }

  input.addEventListener("input", applyFilter);
})();
