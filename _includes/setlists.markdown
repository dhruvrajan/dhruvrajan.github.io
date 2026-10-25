{% assign setlists = site.data.setlists %}

{% for setlist in setlists %}
<section class="group" aria-labelledby="setlist-{{ forloop.index }}">
  <h2 id="setlist-{{ forloop.index }}" class="group-heading">{{ setlist.setlist_name }}</h2>
  {% if setlist.instruments %}
  <p class="item-meta">{{ setlist.instruments | join: ", " }}</p>
  {% endif %}
  <ol class="song-list">
  {% for song_title in setlist.songs %}
    {% assign song = site.data.songs | where: "title", song_title.title | first %}
    <li>
      {% if song and song.youtube_link %}
        <a href="{{ song.youtube_link }}" target="_blank" rel="noopener noreferrer">{{ song_title.title }}</a>
      {% elsif song and song.soundcloud_link %}
        <a href="{{ song.soundcloud_link }}" target="_blank" rel="noopener noreferrer">{{ song_title.title }}</a>
      {% else %}
        {{ song_title.title }}
      {% endif %}
      {% if song and song.artist %}
        <span class="item-meta">{{ song.artist }}</span>
      {% endif %}
    </li>
  {% endfor %}
  </ol>
</section>
{% endfor %}
