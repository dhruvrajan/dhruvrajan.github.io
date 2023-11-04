---
layout: default
title: Setlists
---

<h1>Setlists</h1>
[Songs By Artist](/)

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
      {% assign song = site.data.songs | where: 'title', song_title | first %}
      <li>
        <a href="{{ song.youtube_link }}" target="_blank">{{ song.title }}</a>
      </li>
    {% endfor %}
  </ul>
{% endfor %}