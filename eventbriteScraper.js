const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeEventbriteLA() {
  const response = await axios.get(
    'https://www.eventbrite.com/d/ca--los-angeles/pride/',
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }
  );
  
  const $ = cheerio.load(response.data);
  const events = [];
  
  $('section.discover-vertical-event-card').each((i, elem) => {
    const linkElem = $(elem).find('a.event-card-link').first();
    const url = linkElem.attr('href');
    
    const title = $(elem).find('h3.Typography_body-lg__487rx').text().trim();
    
    const dateTime = $(elem).find('p.Typography_body-md-bold__487rx')
      .not('.EventCardUrgencySignal__label')
      .first()
      .text()
      .trim();
    
    const venue = $(elem).find('p.Typography_body-md__487rx.event-card__clamp-line--one').text().trim();
    
    // Parse date and time from "Sun, Feb 15 •  9:00 PM"
    const dateParts = dateTime.split('•');
    const date = dateParts[0]?.trim() || '';
    const time = dateParts[1]?.trim() || '';
    
    if (title && url) {
      events.push({ 
        name: title,
        date: date,
        start_time: time,
        end_time: '', // Eventbrite doesn't show end time in listings
        location: venue,
        description: url // Store URL as description for now
      });
    }
  });
  
  return events;
}

module.exports = { scrapeEventbriteLA };