'use strict';

// Get list of nearby routes
exports.nearby = async function (req, res) {
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

  try {
    const response = await fetch(
      `https://external.transitapp.com/v3/public/nearby_routes?lat=${lat}&lon=${lon}&max_distance=${distance}`,
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'apiKey': process.env.TRANSIT_API_KEY,
        },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      }
    );

    if (!response.ok) {
      const body = await response.text();

      // Handle rate limiting with more detail
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        console.error('Rate limited by Transit API:', {
          status: 429,
          retryAfter: retryAfter || 'not specified',
          timestamp: new Date().toISOString()
        });

        return res.status(429).json({
          error: 'Rate limit exceeded',
          retryAfter: retryAfter ? parseInt(retryAfter) : 60,
          message: 'Too many requests. Please try again later.'
        });
      }

      console.error('Error response from transit API:', response.status, body);
      return res.status(response.status).json({ error: 'Transit API error' });
    }

    const body = await response.text();

    res.set({
      'Cache-Control': 'public, max-age=30',
      'Vary': 'Accept-Encoding'
    });

    res.status(200).send(body);
  } catch (error) {
    console.error('Error fetching nearby routes:', error);

    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return res.status(504).json({
        error: 'Request timeout',
        message: 'Transit API did not respond in time. Please try again.'
      });
    }

    return res.status(500).json({ error: 'Failed to fetch nearby routes' });
  }
};
