{% assign events = site.data.events %}


{% for event in events %}
  <h2>{{ event.event_name }}</h2>
  <div>
    <span>
        {{ event.location }}
    </span>
    <span>
        {{ event.date }}
    </span>
  </div>
{% endfor %}