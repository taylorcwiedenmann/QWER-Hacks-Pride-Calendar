// test-scraper.js
const { scrapeEventbriteLA } = require('./eventbriteScraper');

scrapeEventbriteLA().then(events => {
  console.log(events.slice(0, 2));
});