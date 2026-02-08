const { auth, google } = require('./auth');

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

module.exports = { getUpcomingEvents };