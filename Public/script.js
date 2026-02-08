
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
      <p>📅 ${event.date}</p>
      <p>🕐 ${event.start_time} - ${event.end_time}</p>
      ${event.location ? `<p>📍 ${event.location}</p>` : ''}
    </div>
  `).join('');
}

// Load events when page loads
document.addEventListener('DOMContentLoaded', fetchUpcomingEvents);
// In your frontend JavaScript file
async function loadEventbriteEvents() {
  try {
    const response = await fetch('/api/events/eventbrite');
    const events = await response.json();
    
    // Display events on your page
    console.log('Pride events from Eventbrite:', events);
    
    // Example: add to your calendar display
    events.forEach(event => {
      displayEvent(event); // Your existing function to show events
    });
    
  } catch (error) {
    console.error('Error loading Eventbrite events:', error);
  }
}

// Call it when page loads
loadEventbriteEvents();