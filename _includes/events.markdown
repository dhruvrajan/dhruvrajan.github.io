{% assign events = site.data.events %}


{% for event in events %}
  {{ event.event_name }}, {{ event.location }}, {{ event.date }}
{% endfor %}