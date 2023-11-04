---
layout: default
title: Setlists
---

<h1>Songs by Artist</h1>

[Sample Setlists](/pages/setlists.html)

{% assign songs = site.data.songs %}

{% assign artists = songs | map: 'artist' | uniq %}

{% for artist in artists %}
  <h2>{{ artist }}</h2>
  <ul>
    {% for song in songs %}
      {% if song.artist == artist  and song.youtube_link %}
        <li>
          <a href="{{ song.youtube_link }}" target="_blank">{{ song.title }}</a>
        </li>
      {% elsif song.artist == artist  and song.soundcloud_link %}
        <li>
          <a href="{{ song.soundcloud_link }}" target="_blank">{{ song.title }}</a>
        </li>
      {% elsif song.artist == artist %}
        <li>
          {{ song.title }}
        </li>
      {% endif %}
    {% endfor %}
  </ul>
{% endfor %}