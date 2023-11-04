{% assign setlists = site.data.setlists %}
{% assign songs = site.data.songs %}
{% assign song_dictionary = {} %}

{% for song in songs %}
  {% capture song_name %}{{ song.title }}{% endcapture %}
  {% assign song_dictionary[song_name] = song %}
{% endfor %}

{% for setlist in setlists %}
  <h2>{{ setlist.setlist_name }}</h2>
  <ul>
    {% for song_title in setlist.songs %}
      {% assign song = site.data.songs | where: 'title', song_title.title | first %}
      {% if song and song.youtube_link %}
        <li>
          <a href="{{ song.youtube_link }}" target="_blank">{{ song_title.title }}</a>
        </li>
      {% elsif song and song.soundcloud_link %}
        <li>
          <a href="{{ song.soundcloud_link }}" target="_blank">{{ song_title.title }}</a>
        </li>
      {% else %}
        <li>
          {{ song_title.title }}
        </li>
      {% endif %}
    {% endfor %}
  </ul>
{% endfor %}