{% assign songs = site.data.songs %}
{% assign artists = songs | map: "artist" | uniq | sort %}

<nav class="jump-nav" aria-label="Artists">
  {% for artist in artists %}
    {% if artist and artist != "" %}
    <a href="#artist-{{ forloop.index }}">{{ artist }}</a>
    {% endif %}
  {% endfor %}
</nav>

{% for artist in artists %}
  {% if artist and artist != "" %}
  <section class="group" id="artist-{{ forloop.index }}" aria-labelledby="artist-heading-{{ forloop.index }}">
    <h2 id="artist-heading-{{ forloop.index }}" class="group-heading">{{ artist }}</h2>
    <ul class="song-list">
    {% for song in songs %}
      {% if song.artist == artist %}
      <li>
        {% if song.youtube_link %}
          <a href="{{ song.youtube_link }}" target="_blank" rel="noopener noreferrer">{{ song.title }}</a>
        {% elsif song.soundcloud_link %}
          <a href="{{ song.soundcloud_link }}" target="_blank" rel="noopener noreferrer">{{ song.title }}</a>
        {% else %}
          {{ song.title }}
        {% endif %}
      </li>
      {% endif %}
    {% endfor %}
    </ul>
  </section>
  {% endif %}
{% endfor %}
