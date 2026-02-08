
/*
function getUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            // Success - got the location
            function(position) {
                const latitude = position.coords.latitude;
                const longitude = position.coords.longitude;
                console.log("User location:", latitude, longitude);
                
                // You can return or use these coordinates here
                return { latitude, longitude };
            },
            // Error - couldn't get location
            function(error) {
                console.error("Location error:", error.message);
                alert("Could not get your location");
            }
        );
    } else {
        alert("Your browser doesn't support geolocation");
    }
}

const location = getUserLocation();

*/


async function fetchUpcomingEvents() {
  const container = document.getElementById('events-container');
  
  try {
    const response = await fetch('http://localhost:3000/api/events/upcoming?limit=3');
    
    if (!response.ok) {
      throw new Error('Failed to fetch events');
    }
    
    const data = await response.json();
    displayEvents(data.events);
    
  } catch (error) {
    container.innerHTML = `<p class="error">Error loading events: ${error.message}</p>`;
  }
}

function displayEvents(events) {
  const container = document.getElementById('events-container');
  
  if (events.length === 0) {
    container.innerHTML = '<p>No upcoming events</p>';
    return;
  }
  
  container.innerHTML = events.map(event => `
    <div class="event-card">
      <h3>${event.name}</h3>
      <p>${event.description}</p>
      <p>📅 ${new Date(event.date).toLocaleDateString()}</p>
      ${event.start_time ? `<p>🕐 ${new Date(event.start_time).toLocaleTimeString()}</p>` : ''}
      ${event.location ? `<p>📍 ${event.location}</p>` : ''}
    </div>
  `).join('');
}

// Load events when page loads
document.addEventListener('DOMContentLoaded', fetchUpcomingEvents);
