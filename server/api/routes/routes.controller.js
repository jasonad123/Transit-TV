'use strict';

// Helper function to check if destination matches current stop (redundant terminus)
function isRedundantTerminus(itinerary) {
  if (!itinerary.closest_stop || !itinerary.merged_headsign) {
    return false;
  }

  const stopName = itinerary.closest_stop.stop_name.toLowerCase().trim();
  const destination = itinerary.merged_headsign.toLowerCase().trim();

  // Extract the core stop name (without "Station" suffix)
  const coreStopName = stopName.replace(/\s+station$/i, '').trim();

  // Check if destination matches the stop name
  // This catches cases like:
  // - Stop: "Waterfront Station", Destination: "Waterfront"
  // - Stop: "Waterfront Station", Destination: "North to Waterfront"
  // - Stop: "King George Station", Destination: "East to King George"

  // Match patterns:
  // 1. Exact match: "waterfront" === "waterfront"
  // 2. With direction: "north to waterfront"
  // 3. With station suffix: "waterfront station"
  const destinationPattern = new RegExp(`^(\\w+\\s+to\\s+)?${coreStopName}(\\s+station)?$`, 'i');

  return destinationPattern.test(destination);
}

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

    const data = await response.json();

    // Filter out redundant terminus entries from each route
    if (data.routes && Array.isArray(data.routes)) {
      data.routes.forEach(route => {
        if (route.itineraries && Array.isArray(route.itineraries)) {
          const beforeCount = route.itineraries.length;
          route.itineraries = route.itineraries.filter(itinerary => {
            const isRedundant = isRedundantTerminus(itinerary);
            if (isRedundant) {
              console.log(`Filtering out redundant terminus: ${itinerary.merged_headsign} at ${itinerary.closest_stop?.stop_name}`);
            }
            return !isRedundant;
          });
          const afterCount = route.itineraries.length;
          if (beforeCount !== afterCount) {
            console.log(`Route ${route.route_short_name}: filtered ${beforeCount - afterCount} redundant terminus entries`);
          }
        }
      });
    }

    res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching nearby routes:', error);
    return res.status(500).json({ error: 'Failed to fetch nearby routes' });
  }
};
