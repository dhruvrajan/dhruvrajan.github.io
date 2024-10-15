{% assign events = site.data.events %}


{% for event in events %}
  <h2>{{ event.event_name }}</h2>
  {{ event.location }}, {{ event.date }}
{% endfor %}