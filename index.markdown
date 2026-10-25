---
layout: home
title: Music
description: Solo acoustic and folk performer — guitar, clawhammer banjo, octave mandolin, and vocals.
---

<section class="home-intro">
  <div class="home-intro__text">
    <h1>Dhruv Rajan</h1>
    <p class="tagline">Solo acoustic &amp; folk · Newport Beach, CA</p>
    <p>I'm a guitarist and multi-instrumentalist performing solo with guitar, clawhammer banjo, octave mandolin, and vocals — at coffee shops, farmers markets, and private events.</p>
    <p>My repertoire features classic acoustic rock and folk from the 70s—Cat Stevens, Jethro Tull, Nic Jones—alongside modern artists like Tallest Man on Earth and Mumford &amp; Sons.</p>
    <p>Browse my <a href="{{ '/pages/setlists.html' | relative_url }}">setlist recordings</a> to hear performances. Happy to tailor a setlist to your venue or event.</p>

    <div class="contact-block">
      <p><strong>Booking &amp; contact</strong></p>
      <p><a href="mailto:dhruv@krishnaprem.com">dhruv@krishnaprem.com</a></p>
      <p><a href="tel:+16502294572">(650) 229-4572</a></p>
      <p>
        <a href="https://www.youtube.com/channel/UCa_LjjQKzbIQUqj-WOH1m7Q" rel="noopener noreferrer">YouTube</a>
        ·
        <a href="https://soundcloud.com/dhruv-rajan" rel="noopener noreferrer">SoundCloud</a>
      </p>
    </div>
  </div>
  <img class="portrait" src="{{ '/images/portrait.jpg' | relative_url }}" alt="Dhruv Rajan performing with guitar">
</section>

{% assign videos = site.data.videos %}
{% assign featured = videos | first %}
{% assign more_videos = videos | slice: 1, videos.size %}

<section aria-labelledby="performances-heading">
  <h2 id="performances-heading" class="section-heading">Selected Performances</h2>

  {% if featured %}
  <div class="video-featured">
    <div class="video">
      <iframe
        src="https://www.youtube.com/embed/{{ featured.id }}"
        title="Selected performance video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerpolicy="strict-origin-when-cross-origin"
        allowfullscreen
        loading="lazy"></iframe>
    </div>
  </div>
  {% endif %}

  {% if more_videos.size > 0 %}
  <h3 class="subheading">More recordings</h3>
  <ul class="thumb-grid">
    {% for video in more_videos %}
    <li>
      <a class="thumb" href="https://www.youtube.com/watch?v={{ video.id }}" target="_blank" rel="noopener noreferrer">
        <img src="https://img.youtube.com/vi/{{ video.id }}/hqdefault.jpg" alt="Watch performance on YouTube" width="480" height="360" loading="lazy">
        <span class="thumb-label">Watch on YouTube</span>
      </a>
    </li>
    {% endfor %}
  </ul>
  <p class="section-more">
    <a href="https://www.youtube.com/channel/UCa_LjjQKzbIQUqj-WOH1m7Q" rel="noopener noreferrer">Full channel on YouTube →</a>
  </p>
  {% endif %}
</section>
