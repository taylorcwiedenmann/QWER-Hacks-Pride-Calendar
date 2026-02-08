const express = require('express');
const router = express.Router();
const { getUpcomingEvents } = require('./services');

router.get('/upcoming', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 3;
    const events = await getUpcomingEvents(limit);
    
    res.json({
      events: events
    });

  } catch (error) {
    console.error('Error in /upcoming route:', error);
    res.status(500).json({
      error: 'Failed to fetch upcoming events',
      message: error.message
    });
  }
});

module.exports = router;
