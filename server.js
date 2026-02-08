require("dotenv").config();

const cors = require('cors');
const express = require("express");
const path = require("path");
const { google } = require("googleapis");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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
  return res.data;
}

async function deleteFromCalendar(googleEventId) {
  const client = await auth.getClient();
  const calendar = google.calendar({ version: "v3", auth: client });
  await calendar.events.delete({
    calendarId: process.env.CALENDAR_ID,
    eventId: googleEventId
  });
}

async function fetchUpcomingEvents({ days = 30 } = {}) {
  const client = await auth.getClient();
  const calendar = google.calendar({ version: "v3", auth: client });

  const timeMin = new Date();
  const timeMax = new Date();
  timeMax.setDate(timeMax.getDate() + days);

  const resp = await calendar.events.list({
    calendarId: process.env.CALENDAR_ID,
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 250
  });

  return (resp.data.items || [])
    .filter(ev => ev.start?.dateTime && ev.end?.dateTime)
    .map(ev => {
      const start = toPSTParts(ev.start.dateTime);
      const end = toPSTParts(ev.end.dateTime);

      return {
        name: ev.summary || "(No title)",
        location: ev.location || "",
        description: ev.description || "",
        date: start.date,
        start_time: start.time,
        end_time: end.time
      };
    });
}

app.get("/ping", function (req, res) {
  res.send("ok");
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

// Admin-only: delete event by Google event id
app.post("/api/admin/delete", async (req, res) => {
  const token = req.get("x-admin-token");
  if (!token || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const { googleEventId } = req.body;
  if (!googleEventId) {
    return res.status(400).json({ ok: false, error: "googleEventId required" });
  }

  try {
    await deleteFromCalendar(googleEventId);
    console.log("Deleted Google event:", googleEventId);
    res.json({ ok: true });
  } catch (err) {
    console.error("Delete error:", err?.message || err);
    res.status(500).json({ ok: false, error: "failed to delete event" });
  }
});

// Get upcoming events
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

// Request deduplication cache
const requestCache = new Map();

// AI Assistant recommendations
app.post("/api/assistant/recommend", async (req, res) => {
  const requestId = Date.now();
  const message = (req.body?.message || "").trim();
  
  console.log(`[${requestId}] New request: "${message}"`);
  
  try {
    if (!message) {
      return res.status(400).json({ ok: false, error: "message required" });
    }

    // Deduplicate identical requests within 2 seconds
    const cacheKey = message.toLowerCase();
    const cachedRequest = requestCache.get(cacheKey);
    if (cachedRequest && Date.now() - cachedRequest < 2000) {
      console.log(`[${requestId}] Duplicate request detected, ignoring`);
      return res.json({ ok: true, type: "chat", message: "Please wait a moment..." });
    }
    requestCache.set(cacheKey, Date.now());

    // Clean old cache entries (older than 5 seconds)
    for (const [key, timestamp] of requestCache.entries()) {
      if (Date.now() - timestamp > 5000) {
        requestCache.delete(key);
      }
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ ok: false, error: "GEMINI_API_KEY not set" });
    }

    const events = await fetchUpcomingEvents({ days: 30 });
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `
You are an event recommendation assistant. You MUST respond with valid JSON only.

User message: ${message}

Events available (JSON):
${JSON.stringify(events)}

CRITICAL: Your response must be ONLY valid JSON with NO markdown, NO explanations, NO preamble.

Response format (choose ONE):

1. For greetings/thanks/casual chat:
{"type": "chat", "message": "brief response under 15 words"}

2. For event recommendations:
{"type": "recommendations", "recommendations": [{"name": "event name", "date": "YYYY-MM-DD", "start_time": "HH:MM", "end_time": "HH:MM", "location": "location", "reason": "why recommended"}]}

3. For requests outside your scope (homework, editing, etc):
{"type": "declined", "message": "I can only help with event recommendations. Would you like to find an event?"}

Rules:
- Return ONLY JSON, no markdown code blocks
- Pick up to 5 events maximum
- Do NOT invent events
- If no events match: {"type": "recommendations", "recommendations": []}
- Keep chat responses under 15 words
- Think hard about vague requests to find connections to events
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // More robust JSON extraction
    let cleaned = text;
    
    // Remove markdown code blocks
    cleaned = cleaned.replace(/^```json\s*/i, "");
    cleaned = cleaned.replace(/^```\s*/i, "");
    cleaned = cleaned.replace(/```$/i, "");
    cleaned = cleaned.trim();

    // Try to find JSON if there's extra text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      console.error(`[${requestId}] JSON parse error:`, parseError.message);
      console.error(`[${requestId}] Raw AI response:`, text);
      
      // Return safe fallback instead of 500 error
      return res.json({ 
        ok: true, 
        type: "chat", 
        message: "Sorry, I had trouble understanding that. Could you rephrase?" 
      });
    }

    // Validate response structure
    if (!parsed.type) {
      console.error(`[${requestId}] Invalid response structure:`, parsed);
      return res.json({ 
        ok: true, 
        type: "chat", 
        message: "Sorry, I had trouble processing that. Could you try again?" 
      });
    }

    console.log(`[${requestId}] AI response type: ${parsed.type}`);

    // Handle different response types
    if (parsed.type === "chat") {
      res.json({ ok: true, type: "chat", message: parsed.message });
    } else if (parsed.type === "declined") {
      res.json({ ok: true, type: "declined", message: parsed.message });
    } else if (parsed.type === "recommendations") {
      res.json({ ok: true, type: "recommendations", recommendations: parsed.recommendations || [] });
    } else {
      // Unknown type fallback
      res.json({ 
        ok: true, 
        type: "chat", 
        message: "I'm not sure how to help with that. Try asking about events!" 
      });
    }
  } catch (err) {
    console.error(`[${requestId}] assistant error:`, err?.message || err);
    
    // Don't return 500 error - return friendly message instead
    res.json({ 
      ok: true, 
      type: "chat", 
      message: "Sorry, something went wrong. Please try again." 
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));