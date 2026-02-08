require("dotenv").config();

const cors = require('cors');
const express = require("express");
const path = require("path");
const { google } = require("googleapis");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const { getPrideEvents } = require('./getPrideEvents'); // Only need this one import

console.log("GOOGLE_KEYFILE:", process.env.GOOGLE_KEYFILE ? "Loaded" : "Not loaded");
console.log("CALENDAR_ID:", process.env.CALENDAR_ID ? "Loaded" : "Not loaded");
console.log("ADMIN_TOKEN:", process.env.ADMIN_TOKEN ? "Loaded" : "Not loaded");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "Public")));
app.use(cors());

// Google auth
const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_KEYFILE,
  scopes: ["https://www.googleapis.com/auth/calendar"]
});

const PST_TIMEZONE = "America/Los_Angeles";

function toPSTParts(dateTimeStr) {
  const d = new Date(dateTimeStr);

  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: PST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(d); // YYYY-MM-DD

  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: PST_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(d); // HH:MM (24h)

  return { date, time };
}

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

    const events = res.data.items || [];

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
    throw error;
  }
}

app.get("/ping", function (req, res) {
  res.send("ok");
});

// Eventbrite events endpoint
app.get('/api/events/eventbrite', async (req, res) => {
  try {
    const events = await getPrideEvents();
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Submit event
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

    if (!title || !start || !end) {
      return res.status(400).json({ ok: false, error: "title, start, and end required" });
    }

    if (title.length > 200) {
      return res.status(400).json({ ok: false, error: "title too long" });
    }

    const eventResource = {
      summary: title,
      description: description || "",
      location: location || "",
      start: { dateTime: new Date(start).toISOString() },
      end: { dateTime: new Date(end).toISOString() }
    };

    const gEvent = await insertToCalendar(eventResource);
    console.log("Created Google event:", gEvent.id, gEvent.htmlLink);

    res.json({
      ok: true,
      googleEventId: gEvent.id,
      htmlLink: gEvent.htmlLink
    });
  } catch (err) {
    console.error("Insert error:", err && err.message ? err.message : err);
    res.status(500).json({ ok: false, error: "failed to create event" });
  }
});


// Sync Eventbrite events to Google Calendar
app.post('/api/events/sync-eventbrite', async (req, res) => {
  try {
    const prideEvents = await getPrideEvents();
    console.log(`Found ${prideEvents.length} pride events to sync`);
    
    if (prideEvents.length > 0) {
      console.log('First event:', JSON.stringify(prideEvents[0], null, 2));
    }
    
    const addedEvents = [];
    
    for (const event of prideEvents) {
      const eventDateTime = parseEventDateTime(event.date, event.start_time);
      
      console.log(`Event: ${event.name}`);
      console.log(`  Date: "${event.date}", Time: "${event.start_time}"`);
      console.log(`  Parsed:`, eventDateTime);
      
      if (!eventDateTime) {
        console.log(`  ❌ Skipping (invalid date)`);
        continue;
      }
      
      // Create the calendar event resource
      const eventResource = {
        summary: event.name,
        description: event.description || '',
        location: event.location || '',
        start: { dateTime: eventDateTime.start },
        end: { dateTime: eventDateTime.end }
      };
      
      try {
        const gEvent = await insertToCalendar(eventResource);
        console.log(`  ✅ Added: ${event.name}`);
        addedEvents.push(gEvent);
      } catch (err) {
        console.error(`  ❌ Failed to add ${event.name}:`, err.message);
      }
    }
    
    res.json({ 
      ok: true, 
      synced: addedEvents.length,
      total: prideEvents.length 
    });
    
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});
// Helper function to parse Eventbrite date/time
function parseEventDateTime(dateStr, timeStr) {
  try {
    // Handle "Sun, Feb 15" format
    const currentYear = new Date().getFullYear();
    
    // Parse the date parts
    const months = {
      'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
      'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    };
    
    // Extract month and day from "Sun, Feb 15"
    const parts = dateStr.replace(',', '').split(' ');
    const month = months[parts[1]];
    const day = parseInt(parts[2]);
    
    if (month === undefined || !day) return null;
    
    // Parse time "9:00 PM"
    let hour = 0;
    let minute = 0;
    
    if (timeStr) {
      const timeParts = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (timeParts) {
        hour = parseInt(timeParts[1]);
        minute = parseInt(timeParts[2]);
        const isPM = timeParts[3].toUpperCase() === 'PM';
        
        if (isPM && hour !== 12) hour += 12;
        if (!isPM && hour === 12) hour = 0;
      }
    }
    
    const start = new Date(currentYear, month, day, hour, minute);
    const end = new Date(start);
    end.setHours(end.getHours() + 2); // 2-hour default duration
    
    return {
      start: start.toISOString(),
      end: end.toISOString()
    };
  } catch (err) {
    console.error('Date parse error:', err);
    return null;
  }
}
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

app.get("/api/events/upcoming", async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days || "30", 10), 180);
    const limit = parseInt(req.query.limit || "3", 10);
    const events = await fetchUpcomingEvents({ days });

    const limitedEvents = events.slice(0, limit);

    res.json({ ok: true, events: limitedEvents });

  } catch (err) {
    console.error("List events error:", err?.message || err);
    res.status(500).json({ ok: false, error: "failed to fetch events" });
  }
});

app.post("/api/assistant/recommend", async (req, res) => {
  try {
    const message = (req.body?.message || "").trim();
    if (!message) {
      return res.status(400).json({ ok: false, error: "message required" });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ ok: false, error: "GEMINI_API_KEY not set" });
    }

    const events = await fetchUpcomingEvents({ days: 30 });
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const prompt = `
You are an event recommendation assistant. Your ONLY job is to:
1. Recommend events from the provided list when users ask for suggestions
2. Respond politely to greetings, thanks, or casual chat (1-2 sentences max)
3. Decline ANY other requests (editing papers, creating content, general questions, etc.)

User message: ${message}

Events available (JSON):
${JSON.stringify(events)}

INSTRUCTIONS:
- If this is a greeting/thanks/casual chat: Respond with {"type": "chat", "message": "your brief response"}
- If asking for event recommendations: Return {"type": "recommendations", "recommendations": [...]}
- If asking for anything else (homework help, editing, general questions): Return {"type": "declined", "message": "I can only help with event recommendations from our calendar. Is there an event you'd like to find?"}

Response format for recommendations:
{
  "type": "recommendations",
  "recommendations": [
    {
      "name": string,
      "date": "YYYY-MM-DD",
      "start_time": "HH:MM",
      "end_time": "HH:MM",
      "location": string,
      "reason": string
    }
  ]
}

Rules:
- Pick up to 5 events max
- Do NOT invent events
- If no events match: return empty recommendations array
- Keep chat responses under 15 words
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    const cleaned = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return res.status(500).json({ ok: false, error: "AI returned non-JSON", raw: text });
    }

    // Handle different response types
    if (parsed.type === "chat") {
      res.json({ ok: true, type: "chat", message: parsed.message });
    } else if (parsed.type === "declined") {
      res.json({ ok: true, type: "declined", message: parsed.message });
    } else {
      res.json({ ok: true, type: "recommendations", recommendations: parsed.recommendations || [] });
    }
  } catch (err) {
    console.error("assistant error:", err?.message || err);
    res.status(500).json({ ok: false, error: "assistant failed" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));