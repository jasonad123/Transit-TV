'use strict';

var request = require('request');

// Get list of nearby routes
exports.nearby = function (req, res) {
  const {lat, lon, max_distance} = req.query;

  request({
    url: `https://external.transitapp.com/v3/public/nearby_routes?lat=${lat}&lon=${lon}&max_distance=${max_distance}`,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'apiKey': process.env.API_KEY,
    }
  }).pipe(res);
};
