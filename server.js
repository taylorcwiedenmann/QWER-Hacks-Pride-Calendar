require("dotenv").config();

const { auth, google } = require('./auth'); 
const express = require("express");
const path = require("path");
//const { google } = require("googleapis");
const eventRoutes = require('./routes');



const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "Public")));
app.use('/api/events', eventRoutes);



// Google auth
/*
const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_KEYFILE,
  scopes: ["https://www.googleapis.com/auth/calendar"]
});
*/
async function insertToCalendar(eventToAdd) {
  const client = await auth.getClient();
  const calendar = google.calendar({ version: "v3", auth: client });

  const res = await calendar.events.insert({
    calendarId: process.env.CALENDAR_ID,
    resource: eventToAdd
  });
  return res.data; // Google event object
}

async function deleteFromCalendar(googleEventId) {
  const client = await auth.getClient();
  const calendar = google.calendar({ version: "v3", auth: client });
  await calendar.events.delete({
    calendarId: process.env.CALENDAR_ID,
    eventId: googleEventId
  });
}

app.get("/ping", function (req, res) {
  res.send("ok");
});


// submit -> directly creates event on Google Calendar
app.post("/api/events/submit", async function (req, res) {
  try {
    const title = req.body.name;
    const description = req.body.description;
    const location = req.body.location;
    const start_time = req.body.start_time;
    const end_time = req.body.end_time;
    const date = req.body.date;
    const start = `${date}T${start_time}:00`;
    const end = `${date}T${end_time}:00`;

    // basic validation & sanitization
    if (!title || !start || !end) {
      return res
        .status(400)
        .json({ ok: false, error: "title, start, and end required" });
    }

    if (title.length > 200) {
      return res
        .status(400)
        .json({ ok: false, error: "title too long" });
    }

    // build Google event resource
    const eventResource = {
      summary: title,
      description: description || "",
      location: location || "",
      start: { dateTime: new Date(start).toISOString() },
      end: { dateTime: new Date(end).toISOString() }
    };

    // Insert
    const gEvent = await insertToCalendar(eventResource);

    // Log the google event id (server logs) so admin can delete if needed
    console.log("Created Google event:", gEvent.id, gEvent.htmlLink);

    // Return event id to caller
    res.json({
      ok: true,
      googleEventId: gEvent.id,
      htmlLink: gEvent.htmlLink
    });
  } catch (err) {
    console.error("Insert error:", err && err.message ? err.message : err);
    res
      .status(500)
      .json({ ok: false, error: "failed to create event" });
  }
});

// admin-only: delete event by Google event id
app.post("/api/admin/delete", async (req, res) => {
  const token = req.get("x-admin-token");
  if (!token || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const { googleEventId } = req.body;
  if (!googleEventId) return res.status(400).json({ ok: false, error: "googleEventId required" });

  try {
    await deleteFromCalendar(googleEventId);
    console.log("Deleted Google event:", googleEventId);
    res.json({ ok: true });
  } catch (err) {
    console.error("Delete error:", err?.message || err);
    res.status(500).json({ ok: false, error: "failed to delete event" });
  }
});



async function getUpcomingEvents(limit = 3) {
  try {
    const now = new Date().toISOString();
    
    const client = await auth.getClient();
    const calendar = google.calendar({ version: "v3", auth: client });
    
    const res = await calendar.events.list({
      calendarId: process.env.CALENDAR_ID,
      timeMin: now,
      maxResults: limit,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = res.data.items;

    return events.map(event => ({
      name: event.summary,
      description: event.description || '',
      date: event.start.date || event.start.dateTime,
      start_time: event.start.dateTime,
      end_time: event.end.dateTime,
      location: event.location || '',
      htmlLink: event.htmlLink
    }));

  } catch (error) {
    console.error('Error fetching calendar events:', error);
    throw new Error('Failed to fetch calendar events');
  }
}

module.exports = { getUpcomingEvents };

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
//module.exports = { auth };
