{% assign events = site.data.events %}


{% for event in events %}
  <h3>{{ event.event_name }}</h3>
  {{ event.location }}, {{ event.date }}
{% endfor %}