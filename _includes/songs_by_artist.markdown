{% assign songs = site.data.songs %}
{% assign artists_all = songs | map: "artist" | compact | uniq | sort %}

<div class="songs-toolbar">
  <label class="songs-filter" for="songs-filter-input">
    <span class="songs-filter__label">Filter</span>
    <input id="songs-filter-input" type="search" placeholder="Song or artist…" autocomplete="off" spellcheck="false">
  </label>
  <p class="songs-filter__status" id="songs-filter-status" aria-live="polite"></p>
</div>

<nav class="jump-nav" aria-label="Artists" id="songs-jump-nav">
  {% for artist in artists_all %}
    {% unless artist == "Unknown" %}
    <a href="#artist-{{ forloop.index }}" data-artist="{{ artist | escape }}">{{ artist }}</a>
    {% endunless %}
  {% endfor %}
  {% for artist in artists_all %}
    {% if artist == "Unknown" %}
    <a href="#artist-unknown" data-artist="Unknown">Unknown</a>
    {% endif %}
  {% endfor %}
</nav>

<div id="songs-by-artist">
{% for artist in artists_all %}
  {% unless artist == "Unknown" %}
  <section class="group artist-group" id="artist-{{ forloop.index }}" data-artist="{{ artist | escape }}" aria-labelledby="artist-heading-{{ forloop.index }}">
    <h2 id="artist-heading-{{ forloop.index }}" class="group-heading">{{ artist }}</h2>
    <ul class="song-list">
    {% for song in songs %}
      {% if song.artist == artist %}
      <li class="song-item" data-title="{{ song.title | escape }}" data-artist="{{ song.artist | escape }}">
        {% if song.youtube_link %}
          <a href="{{ song.youtube_link }}" target="_blank" rel="noopener noreferrer">{{ song.title }}</a>
        {% elsif song.soundcloud_link %}
          <a href="{{ song.soundcloud_link }}" target="_blank" rel="noopener noreferrer">{{ song.title }}</a>
        {% else %}
          {{ song.title }}
        {% endif %}
        <a class="lyrics-quick" href="{{ '/pages/lyrics.html' | relative_url }}#song={{ song.title | append: '-' | append: song.artist | slugify }}">Lyrics</a>
      </li>
      {% endif %}
    {% endfor %}
    </ul>
  </section>
  {% endunless %}
{% endfor %}

{% for artist in artists_all %}
  {% if artist == "Unknown" %}
  <section class="group artist-group" id="artist-unknown" data-artist="Unknown" aria-labelledby="artist-heading-unknown">
    <h2 id="artist-heading-unknown" class="group-heading">Unknown</h2>
    <p class="item-meta">Artist not listed in the source audit — left as Unknown rather than guessed.</p>
    <ul class="song-list">
    {% for song in songs %}
      {% if song.artist == "Unknown" %}
      <li class="song-item" data-title="{{ song.title | escape }}" data-artist="Unknown">
        {% if song.youtube_link %}
          <a href="{{ song.youtube_link }}" target="_blank" rel="noopener noreferrer">{{ song.title }}</a>
        {% elsif song.soundcloud_link %}
          <a href="{{ song.soundcloud_link }}" target="_blank" rel="noopener noreferrer">{{ song.title }}</a>
        {% else %}
          {{ song.title }}
        {% endif %}
        <a class="lyrics-quick" href="{{ '/pages/lyrics.html' | relative_url }}#song={{ song.title | append: '-Other' | slugify }}">Lyrics</a>
      </li>
      {% endif %}
    {% endfor %}
    </ul>
  </section>
  {% endif %}
{% endfor %}
</div>

<script src="{{ '/assets/js/songs-filter.js' | relative_url }}" defer></script>
