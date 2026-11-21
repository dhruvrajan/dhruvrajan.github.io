{%- comment -%}
  Compact tuning/capo next to a song title.
  Accepts flat tuning/capo or instruments: [{name, tuning, capo, unverified}].
{%- endcomment -%}
{%- assign setup_bits = "" -%}
{%- if song.instruments and song.instruments.size > 0 -%}
  {%- if song.instruments.size == 1 -%}
    {%- assign inst = song.instruments.first -%}
    {%- if inst.tuning -%}
      {%- assign setup_bits = inst.tuning -%}
      {%- if inst.unverified -%}{%- assign setup_bits = setup_bits | append: "?" -%}{%- endif -%}
    {%- endif -%}
    {%- if inst.capo and inst.capo != 0 -%}
      {%- if setup_bits != "" -%}{%- assign setup_bits = setup_bits | append: " · " -%}{%- endif -%}
      {%- assign setup_bits = setup_bits | append: "Capo " | append: inst.capo -%}
    {%- endif -%}
  {%- else -%}
    {%- for inst in song.instruments -%}
      {%- assign abbr = inst.name -%}
      {%- assign nm = inst.name | downcase -%}
      {%- if nm == "guitar" -%}{%- assign abbr = "Gtr" -%}
      {%- elsif nm == "octave mandolin" or nm == "mandolin" -%}{%- assign abbr = "OM" -%}
      {%- endif -%}
      {%- assign piece = abbr | append: ": " -%}
      {%- if inst.tuning -%}
        {%- assign piece = piece | append: inst.tuning -%}
        {%- if inst.unverified -%}{%- assign piece = piece | append: "?" -%}{%- endif -%}
      {%- endif -%}
      {%- if inst.capo and inst.capo != 0 -%}
        {%- if inst.tuning -%}{%- assign piece = piece | append: " · " -%}{%- endif -%}
        {%- assign piece = piece | append: "Capo " | append: inst.capo -%}
      {%- endif -%}
      {%- if setup_bits != "" -%}{%- assign setup_bits = setup_bits | append: " · " -%}{%- endif -%}
      {%- assign setup_bits = setup_bits | append: piece -%}
    {%- endfor -%}
  {%- endif -%}
{%- elsif song.tuning or song.capo -%}
  {%- if song.tuning -%}
    {%- assign setup_bits = song.tuning -%}
    {%- if song.tuning_unverified -%}{%- assign setup_bits = setup_bits | append: "?" -%}{%- endif -%}
  {%- endif -%}
  {%- if song.capo and song.capo != 0 -%}
    {%- if setup_bits != "" -%}{%- assign setup_bits = setup_bits | append: " · " -%}{%- endif -%}
    {%- assign setup_bits = setup_bits | append: "Capo " | append: song.capo -%}
  {%- endif -%}
{%- endif -%}
{%- if setup_bits != "" -%}
<span class="song-setup">{{ setup_bits }}</span>
{%- endif -%}
