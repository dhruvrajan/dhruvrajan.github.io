{% assign events = site.data.events %}

{% for event in events %}
  <h3>{{ event.event_name }}</h3>
  <p class="event-meta">{{ event.location }}, {{ event.date }}</p>
{% endfor %}
