---
layout: home
title: Music
---

<!-- Adding Tailwind CSS CDN for styling -->
<link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">

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
</style>

<div class="nav-links">
  <a href="/pages/events.html">Past Performances</a> |
  <a href="/pages/setlists.html">Sample Setlists & Recordings</a> |
  <a href="/pages/songs_by_artist.html">All Songs by Artist</a>
</div>

---

<div class="container mx-auto px-4 py-8">
  <div class="text-center mb-8">
    <p class="text-lg">Hi! My name is Dhruv Rajan. I'm an avid guitarist and multi-instrumentalist living in the Bay Area, CA. I perform solo on guitar, clawhammer banjo, octave mandolin, and vocals, and would love to discuss opportunities to perform at coffee shops, farmers markets, and other events.</p>
    <p class="text-lg mt-4">I mainly play arrangements of classic acoustic rock and folk songs, particularly from the 70’s (Cat Stevens, Jethro Tull, Nic Jones), along with some more recent selections like Tallest Man on Earth and Mumford and Sons.</p>
    <p class="text-lg mt-4">For examples of my playing, please check out my <a href="/pages/setlists.html" class="text-blue-600 hover:underline">setlist recordings</a>.</p>
    <p class="text-lg mt-4">I’m always happy to tailor my setlist to fit the environment best! Please let me know any thoughts you might have to prepare for an enjoyable performance.</p>
  </div>

  <!-- Single row for contact, video, and images -->
  <div class="flex flex-col md:flex-row items-center justify-center gap-6 mb-8">
    <!-- Contact Section -->
    <div class="bg-gray-100 p-6 rounded-lg shadow-md w-full md:w-1/3">
      <h2 class="text-xl font-semibold mb-4">Contact Me</h2>
      <p><strong>Dhruv Rajan</strong></p>
      <p><a href="mailto:dhruv@krishnaprem.com" class="text-blue-600 hover:underline">dhruv@krishnaprem.com</a></p>
      <p>(650) 229-4572</p>
      <p><a href="https://www.youtube.com/channel/UCa_LjjQKzbIQUqj-WOH1m7Q" class="text-blue-600 hover:underline">YouTube</a> | <a href="https://soundcloud.com/dhruv-rajan" class="text-blue-600 hover:underline">SoundCloud</a></p>
    </div>

    <!-- Video Section -->
    <div class="w-full md:w-1/3">
      <h2 class="text-xl font-semibold mb-4 text-center">My YouTube Playlist</h2>
      <div class="relative" style="padding-bottom: 56.25%; height: 0;">
        <iframe class="absolute top-0 left-0 w-full h-full rounded-lg" src="https://www.youtube.com/embed/3JAcX3mY5e4?si=KUA9yE3OLjXQnMrX" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
      </div>
    </div>

    <!-- Images Section -->
    <div class="flex flex-col gap-4 w-full md:w-1/3">
      <h2 class="text-xl font-semibold mb-4 text-center">Performances</h2>
      <div class="flex gap-4">
        <img src="/images/IMG_0461.jpg" alt="Performance photo 1" class="w-1/2 h-40 object-cover rounded-lg shadow-md">
        <img src="/images/winery.jpg" alt="Performance photo 2" class="w-1/2 h-40 object-cover rounded-lg shadow-md">
      </div>
    </div>
  </div>
</div>
