---
layout: home
title: Music
---

<style>
  .nav-links {
    text-align: center;
    margin: 1.5em 0;
    font-size: 1.2em;
  }

  .nav-links a {
    margin: 0 1em;
    text-decoration: none;
    color: #1a73e8;
  }

  .video-grid {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 20px;
    margin: 2em 0;
  }

  .video-grid iframe {
    max-width: 100%;
    width: 560px;
    height: 315px;
    border-radius: 8px;
  }

  .image-row {
    display: flex;
    justify-content: center;
    gap: 20px;
    margin-top: 2em;
  }

  .image-row img {
    height: 250px;
    border-radius: 8px;
    object-fit: cover;
  }
</style>

<div style="text-align:center;">
  <a href="/pages/events.html">Past Performances</a> |
  <a href="/pages/setlists.html">Sample Setlists & Recordings</a> |
  <a href="/pages/songs_by_artist.html">All Songs by Artist</a>
</div>

---

Hi! My name is Dhruv Rajan. I'm an avid guitarist and multi-instrumentalist living in the Bay Area, CA. I perform solo on guitar, clawhammer banjo, octave mandolin, and vocals, and would love to discuss opportunities to perform at coffee shops, farmers and other events.

I mainly play arrangements of classic acoustic rock and folk songs, particuarly from the 70’s (Cat Stevens, Jethro Tull, Nic Jones), along with some more recent selections like Tallest Man on Earth, and Mumford and Sons.

For examples of my playing, please check out my [setlist recordings](/pages/setlists.html).

I’m always happy to tailor my setlist to fit the environment best! Please let me know any thoughts you might have to prepare for an enjoyable performance.

---


**Contact me:**  
Dhruv Rajan  


[dhruv@krishnaprem.com](mailto:dhruv@krishnaprem.com)  


(650) 229-4572  


[YouTube](https://www.youtube.com/channel/UCa_LjjQKzbIQUqj-WOH1m7Q) | [SoundCloud](https://soundcloud.com/dhruv-rajan)


---
# My YouTube Playlist

<div class="player">
  <iframe id="mainPlayer" src="https://www.youtube.com/embed/uCfZE9MxoTA" allowfullscreen></iframe>
</div>

<div class="video-grid" id="videoGrid"></div>

{% raw %}
<style>
  .video-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
    justify-content: center;
    margin: 2em auto;
    max-width: 1000px;
  }

  .video-grid img {
    width: 300px;
    cursor: pointer;
    border-radius: 8px;
    transition: transform 0.2s;
  }

  .video-grid img:hover {
    transform: scale(1.05);
  }

  .player {
    display: flex;
    justify-content: center;
    margin-top: 2em;
  }

  iframe {
    width: 560px;
    height: 315px;
    border: none;
    border-radius: 8px;
  }
</style>

<script>
  const videoIds = [
    '3JAcX3mY5e4',
    'uCfZE9MxoTA',
    '7l0m7DScp94',
    '3DIuH4BS8ds',
    'tlYO5shY4dk',
    // Add more video IDs here
  ];

  const grid = document.getElementById('videoGrid');
  const player = document.getElementById('mainPlayer');

  videoIds.forEach(id => {
    const img = document.createElement('img');
    img.src = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
    img.alt = "Video thumbnail";
    img.onclick = () => {
      player.src = `https://www.youtube.com/embed/${id}?autoplay=1`;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    grid.appendChild(img);
  });
</script>
{% endraw %}

<div class="image-row">
  <img src="/images/IMG_0461.jpg" alt="Performance photo 1">
  <img src="/images/winery.jpg" alt="Performance photo 2">
</div>
