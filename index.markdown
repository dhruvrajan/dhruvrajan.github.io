---
layout: home
title: Dhruv Rajan - Music
---

<!-- Tailwind CSS CDN -->
<link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">

<style>
  body {
    background: #FAFAFA; /* Soft white background */
  }
  .video-list {
/*     max-height: 100vh; /* Fixed height for scrollable list */ */
    overflow-y: auto; /* Enable vertical scrolling */
    scrollbar-width: thin; /* Subtle scrollbar for Firefox */
  }
  .video-list::-webkit-scrollbar {
    width: 6px; /* Subtle scrollbar for Chrome/Safari */
  }
  .video-list::-webkit-scrollbar-thumb {
    background-color: #E5E7EB; /* Light gray scrollbar */
    border-radius: 4px;
  }
  .no-scroll {
    height: 100vh; /* Full viewport height */
    overflow: hidden; /* Prevent page scroll on desktop */
  }
  @media (max-width: 768px) {
    .no-scroll {
      overflow: auto; /* Allow scroll on mobile */
    }
  }
</style>

<div class="container mx-auto px-4 py-8 font-sans max-w-6xl no-scroll">
  <!-- Two-Column Layout -->
  <div class="grid grid-cols-1 md:grid-cols-5 gap-6 h-full">
    <!-- Left Column: Navigation, Text, and Contact -->
    <div class="md:col-span-3 flex flex-col space-y-6 h-full max-h-[500px]">
      <!-- Navigation Card -->
      <div class="bg-white border border-gray-200 p-4 rounded-lg shadow-sm hover:scale-105 transition-transform duration-300">
        <nav class="flex space-x-4">
          <a href="/pages/events.html" class="text-gray-600 hover:bg-blue-600 hover:text-white transition duration-300 px-3 py-1 rounded-md font-medium text-sm">Past Performances</a>
          <a href="/pages/setlists.html" class="text-gray-600 hover:bg-blue-600 hover:text-white transition duration-300 px-3 py-1 rounded-md font-medium text-sm">Setlists & Recordings</a>
          <a href="/pages/songs_by_artist.html" class="text-gray-600 hover:bg-blue-600 hover:text-white transition duration-300 px-3 py-1 rounded-md font-medium text-sm">Songs by Artist</a>
        </nav>
      </div>

      <!-- Main Text Card -->
      <div class="bg-white border border-gray-200 p-6 rounded-lg shadow-sm hover:scale-105 transition-transform duration-300 max-h-[200px] overflow-auto">
        <div class="prose prose-base text-gray-600">
          <p class="mb-4">I'm Dhruv, a passionate guitarist and multi-instrumentalist based in the Bay Area, CA. I perform solo with guitar, clawhammer banjo, octave mandolin, and vocals, bringing music to coffee shops, farmers markets, and events.</p>
          <p class="mb-4">My repertoire features classic acoustic rock and folk from the 70’s—think Cat Stevens, Jethro Tull, and Nic Jones—alongside modern artists like Tallest Man on Earth and Mumford and Sons.</p>
          <p class="mb-4">Check out my <a href="/pages/setlists.html" class="text-blue-600 hover:underline">setlist recordings</a> to hear my performances. I’m happy to tailor my setlist to your venue or event—let’s create a memorable show together!</p>
        </div>
      </div>

      <!-- Contact Card with Photo -->
      <div class="bg-white border border-gray-200 p-6 rounded-lg shadow-sm hover:scale-105 transition-transform duration-300 h-[350px] flex flex-row items-start">
        <div class="flex-1">
          
          <p class="text-gray-600"><strong>Dhruv Rajan</strong></p>
          <p class="text-gray-600"><a href="mailto:dhruv@krishnaprem.com" class="text-blue-600 hover:underline">dhruv@krishnaprem.com</a></p>
          <p class="text-gray-600">(650) 229-4572</p>
          <p class="text-gray-600 mt-2">
            <a href="https://www.youtube.com/channel/UCa_LjjQKzbIQUqj-WOH1m7Q" class="text-blue-600 hover:underline">YouTube</a> | 
            <a href="https://soundcloud.com/dhruv-rajan" class="text-blue-600 hover:underline">SoundCloud</a>
          </p>
        </div>
        <div class="border-l border-gray-200 h-full mx-4"></div>
        <div class="flex justify-center items-center w-1/2">
          <img src="/images/IMG_0461.jpg" alt="Performance photo" class="h-36 object-contain rounded-md">
        </div>
      </div>
    </div>

    <!-- Right Column: Scrollable YouTube Videos -->
    <div class="md:col-span-2 flex flex-1 flex-col h-full max-h-[500px]">
      <div class="bg-white border border-gray-200 p-8 rounded-lg shadow-sm hover:scale-105 transition-transform duration-300 h-[450px] flex flex-col">
        <h2 class="text-lg font-bold text-gray-800 mb-4">Selected Performances</h2>
        <div class="video-list flex-1">
          <!-- 14 video links -->
          <div class="mb-4">
            <div class="relative" style="padding-bottom: 56.25%; height: 0;">
              <iframe class="absolute top-0 left-0 w-full h-full rounded-md" src="https://www.youtube.com/embed/3JAcX3mY5e4" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
            </div>
          </div>
          <div class="mb-4">
            <div class="relative" style="padding-bottom: 56.25%; height: 0;">
              <iframe class="absolute top-0 left-0 w-full h-full rounded-md" src="https://www.youtube.com/embed/uCfZE9MxoTA" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
            </div>
          </div>
          <div class="mb-4">
            <div class="relative" style="padding-bottom: 56.25%; height: 0;">
              <iframe class="absolute top-0 left-0 w-full h-full rounded-md" src="https://www.youtube.com/embed/7l0m7DScp94" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
            </div>
          </div>
          <div class="mb-4">
            <div class="relative" style="padding-bottom: 56.25%; height: 0;">
              <iframe class="absolute top-0 left-0 w-full h-full rounded-md" src="https://www.youtube.com/embed/3DIuH4BS8ds" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
            </div>
          </div>
          <div class="mb-4">
            <div class="relative" style="padding-bottom: 56.25%; height: 0;">
              <iframe class="absolute top-0 left-0 w-full h-full rounded-md" src="https://www.youtube.com/embed/tlYO5shY4dk" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
            </div>
          </div>
          <div class="mb-4">
            <div class="relative" style="padding-bottom: 56.25%; height: 0;">
              <iframe class="absolute top-0 left-0 w-full h-full rounded-md" src="https://www.youtube.com/embed/0SYvUWQqR1s" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
            </div>
          </div>
          <div class="mb-4">
            <div class="relative" style="padding-bottom: 56.25%; height: 0;">
              <iframe class="absolute top-0 left-0 w-full h-full rounded-md" src="https://www.youtube.com/embed/E5_Q0tIqDSk" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
            </div>
          </div>
          <div class="mb-4">
            <div class="relative" style="padding-bottom: 56.25%; height: 0;">
              <iframe class="absolute top-0 left-0 w-full h-full rounded-md" src="https://www.youtube.com/embed/vfmbufxg7tU" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
            </div>
          </div>
          <div class="mb-4">
            <div class="relative" style="padding-bottom: 56.25%; height: 0;">
              <iframe class="absolute top-0 left-0 w-full h-full rounded-md" src="https://www.youtube.com/embed/SZesABJoEpY" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
            </div>
          </div>
          <div class="mb-4">
            <div class="relative" style="padding-bottom: 56.25%; height: 0;">
              <iframe class="absolute top-0 left-0 w-full h-full rounded-md" src="https://www.youtube.com/embed/OBK7vbtGDXg" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
            </div>
          </div>
          <div class="mb-4">
            <div class="relative" style="padding-bottom: 56.25%; height: 0;">
              <iframe class="absolute top-0 left-0 w-full h-full rounded-md" src="https://www.youtube.com/embed/EdKrhMwY64w" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
            </div>
          </div>
          <div class="mb-4">
            <div class="relative" style="padding-bottom: 56.25%; height: 0;">
              <iframe class="absolute top-0 left-0 w-full h-full rounded-md" src="https://www.youtube.com/embed/fuHATtM9ZZo" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
            </div>
          </div>
          <div class="mb-4">
            <div class="relative" style="padding-bottom: 56.25%; height: 0;">
              <iframe class="absolute top-0 left-0 w-full h-full rounded-md" src="https://www.youtube.com/embed/sjDa4spV9-8" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
            </div>
          </div>
          <div class="mb-4">
            <div class="relative" style="padding-bottom: 56.25%; height: 0;">
              <iframe class="absolute top-0 left-0 w-full h-full rounded-md" src="https://www.youtube.com/embed/hFHqbJ4IeAE" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
