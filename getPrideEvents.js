require('dotenv').config();
const { scrapeEventbriteLA } = require('./eventbriteScraper');
const { filterPrideEvents } = require('./geminiFilter');

async function getPrideEvents() {
  try {
    const allEvents = await scrapeEventbriteLA();
    console.log(`Scraped ${allEvents.length} events`);
    
    const prideEvents = await filterPrideEvents(allEvents, process.env.GEMINI_API_KEY);
    console.log(`Found ${prideEvents.length} pride events`);
    
    return prideEvents;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

module.exports = { getPrideEvents };