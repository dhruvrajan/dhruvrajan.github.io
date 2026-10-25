{% assign events = site.data.events %}
{% assign years = "" %}
{% for event in events %}
  {% assign year = event.date | split: "," | last | strip %}
  {% unless years contains year %}
    {% assign years = years | append: year | append: "," %}
  {% endunless %}
{% endfor %}
{% assign year_list = years | split: "," | uniq %}

{% for year in year_list %}
  {% if year != "" %}
  <section class="group" aria-labelledby="year-{{ year }}">
    <h2 id="year-{{ year }}" class="group-heading">{{ year }}</h2>
    <ul class="plain-list">
    {% for event in events %}
      {% assign event_year = event.date | split: "," | last | strip %}
      {% if event_year == year %}
      <li>
        <span class="item-title">{{ event.event_name }}</span>
        <span class="item-meta">{{ event.location }} · {{ event.date | remove: year | remove: "," | strip }}</span>
      </li>
      {% endif %}
    {% endfor %}
    </ul>
  </section>
  {% endif %}
{% endfor %}
