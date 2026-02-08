class Event{
    constructor(name, date, start_time, end_time, location, description){
       this.name = name;
       this.date = date;
       this.start_time = start_time;
       this.end_time = end_time;
       this.location = location;
       this.description = description || ""; 
    }
    

}
const form = document.getElementById("event-form");
const map = document.getElementById("map");

form.addEventListener('submit', async function(e){
    e.preventDefault(); 

    const name = document.getElementById("event-name").value;
    const date = document.getElementById("event-date").value;
    const start_time = document.getElementById("event-start-time").value;
    const end_time = document.getElementById("event-end-time").value;
    const location = document.getElementById("event-location").value;
    const description = document.getElementById("event-description").value

    const thisEvent = new Event(name, date, start_time, end_time, location, description);

    //push event to calender
    const response = await fetch("/api/events/submit", {
        method: "POST",
        headers: {
        "Content-Type": "application/json"
        },
        body: JSON.stringify(thisEvent)
    }); 
    
    

    
    if(response.ok){
        console.log("Event created:", thisEvent);
        document.body.innerHTML = `
        <div style="text-align: center; padding: 50px;">
            <h1>✅ Event Submitted Successfully!</h1>
            <p>Thank you for submitting your pride event.</p>
            <a href="submit.html">Submit Another Event</a> | 
            <a href="index.html">Go to Home</a>
        </div>
    `;
    }
    else{
        console.log("Event creation failed");
        document.body.innerHTML = `
        <div style="text-align: center; padding: 50px;">
            <h1>Event Submission Failed</h1>
            <a href="submit.html">Submit Another Event</a> | 
            <a href="index.html">Go to Home</a>
        </div>
    `;
    }
    
    form.reset();


});


