

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

