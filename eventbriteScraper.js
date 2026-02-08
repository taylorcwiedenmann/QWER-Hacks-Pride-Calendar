const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeEventbriteLA() {
  const response = await axios.get(
    'https://www.eventbrite.com/d/ca--los-angeles/events/',
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
    
    // Fixed selectors - skip urgency signals
    const dateTime = $(elem).find('p.Typography_body-md-bold__487rx')
      .not('.EventCardUrgencySignal__label')
      .first()
      .text()
      .trim();
    
    const venue = $(elem).find('p.Typography_body-md__487rx.event-card__clamp-line--one').text().trim();
    
    // Get organizer - it's the second bold text that's not date/urgency
    const organizer = $(elem).find('div > p.Typography_body-md-bold__487rx')
      .not('.EventCardUrgencySignal__label')
      .eq(1)
      .text()
      .trim();
    
    if (title && url) {
      events.push({ 
        title,
        url,
        dateTime,
        venue,
        organizer,
        description: `${title} at ${venue} on ${dateTime}`
      });
    }
  });
  
  return events;
}

module.exports = { scrapeEventbriteLA };