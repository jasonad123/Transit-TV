'use strict';

var request = require('request');

// Get list of nearby routes
exports.nearby = function (req, res) {
  const {lat, lon, max_distance} = req.query;
  
  // Validate required parameters
  if (!lat || !lon) {
    return res.status(400).json({ error: 'Missing required parameters: lat and lon are required' });
  }
  
  // Use default max_distance if not provided
  const distance = max_distance || 1000;
  
  // Validate that lat and lon are valid numbers
  if (isNaN(parseFloat(lat)) || isNaN(parseFloat(lon))) {
    return res.status(400).json({ error: 'Invalid parameters: lat and lon must be valid numbers' });
  }

  request({
    url: `https://external.transitapp.com/v3/public/nearby_routes?lat=${lat}&lon=${lon}&max_distance=${distance}`,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'apiKey': process.env.TRANSIT_API_KEY,
    },
    timeout: 10000 // 10 second timeout
  }, function(error, response, body) {
    if (error) {
      console.error('Error fetching nearby routes:', error);
      return res.status(500).json({ error: 'Failed to fetch nearby routes' });
    }

    if (response.statusCode !== 200) {
      console.error('Error response from transit API:', response.statusCode, body);
      return res.status(response.statusCode).json({ error: 'Transit API error' });
    }

    res.status(200).send(body);
  });
};
