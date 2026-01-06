# Micromobility API Integration

This document describes the integration of the Transit v4 API's `/map_layers/placemarks` endpoint for displaying micromobility data (bikes, scooters, etc.) in Transit TV.

## Overview

The placemarks API provides information about micromobility options near a location, including:
- **Floating vehicles**: Individual bikes and scooters that can be picked up anywhere
- **Docking stations**: Fixed locations where bikes can be picked up and returned

## Architecture

The implementation follows the same pattern as the existing transit routes API:

```
Frontend (Svelte) → SvelteKit Proxy → Node.js Backend → Transit API
```

### Files Created

1. **Backend Controller**: `server/api/placemarks/placemarks.controller.js`
   - Handles requests to Transit v4 API
   - Implements caching (30s default TTL)
   - Error handling and rate limiting

2. **Backend Routes**: `server/api/placemarks/index.js`
   - Defines Express routes for placemarks

3. **SvelteKit Proxy**: `svelte-app/src/routes/api/placemarks/+server.ts`
   - Proxies frontend requests to backend

4. **Frontend Service**: `svelte-app/src/lib/services/placemarks.ts`
   - TypeScript types for API responses
   - Functions to fetch and analyze placemarks data
   - Helper utilities for statistics

## API Endpoints

### Backend API

**GET** `/api/placemarks`

Query Parameters:
- `lat` (required): Latitude
- `lon` (required): Longitude
- `distance` (optional): Search radius in meters (default: 500)

Example:
```bash
curl "http://localhost:8080/api/placemarks?lat=40.7589&lon=-73.9851&distance=500"
```

### Frontend API

**GET** `/api/placemarks` (proxied through SvelteKit)

Same parameters as backend API.

## Data Types

### FloatingPlacemark

Represents a single vehicle (bike, scooter, etc.) that can be found at a specific location.

```typescript
interface FloatingPlacemark {
  type: 'floating';
  id: string;
  lat: number;
  lon: number;
  vehicle_type?: string;  // e.g., "bike", "scooter", "e-bike"
  provider?: string;
  [key: string]: unknown;
}
```

### StationPlacemark

Represents a docking station with a human-readable description of available bikes/docks.

```typescript
interface StationPlacemark {
  type: 'station';
  id: string;
  lat: number;
  lon: number;
  name?: string;
  description?: string;  // e.g., "5 bikes, 3 e-bikes, 10 docks"
  provider?: string;
  [key: string]: unknown;
}
```

### PlacemarksResponse

```typescript
interface PlacemarksResponse {
  placemarks: Placemark[];
}
```

## Usage Examples

### Basic Fetch

```typescript
import { fetchPlacemarks } from '$lib/services/placemarks';

const location = { latitude: 40.7589, longitude: -73.9851 };
const response = await fetchPlacemarks(location, 500);

console.log(`Found ${response.placemarks.length} placemarks`);
```

### Analyzing Data

```typescript
import { fetchMicromobilityStats } from '$lib/services/placemarks';

const location = { latitude: 40.7589, longitude: -73.9851 };
const stats = await fetchMicromobilityStats(location, 500);

console.log(`Floating vehicles: ${stats.floatingVehicles.total}`);
console.log(`By type:`, stats.floatingVehicles.byType);
console.log(`Stations: ${stats.stations.total}`);
console.log(`Station descriptions:`, stats.stations.descriptions);
```

### Manual Analysis

```typescript
import { fetchPlacemarks, analyzePlacemarks } from '$lib/services/placemarks';

const location = { latitude: 40.7589, longitude: -73.9851 };
const response = await fetchPlacemarks(location, 500);
const stats = analyzePlacemarks(response);

// Count bikes by type
Object.entries(stats.floatingVehicles.byType).forEach(([type, count]) => {
  console.log(`${type}: ${count}`);
});

// List all station descriptions
stats.stations.descriptions.forEach(desc => {
  console.log(`Station: ${desc}`);
});
```

## MicromobilityStats Type

The `analyzePlacemarks` function returns aggregated statistics:

```typescript
interface MicromobilityStats {
  floatingVehicles: {
    total: number;
    byType: Record<string, number>;      // e.g., { "bike": 5, "scooter": 3 }
    byProvider: Record<string, number>;
  };
  stations: {
    total: number;
    byProvider: Record<string, number>;
    descriptions: string[];  // Human-readable strings from API
  };
}
```

## Caching

The implementation includes multiple caching layers:

1. **Server-side cache** (optional, via `ENABLE_SERVER_CACHE`):
   - Default TTL: 30 seconds
   - Configurable via `PLACEMARKS_CACHE_TTL` env var
   - In-flight request deduplication

2. **Client-side cache** (via `apiCache` utility):
   - Inherits TTL from server Cache-Control headers

## Environment Variables

- `PLACEMARKS_CACHE_TTL`: Cache duration in milliseconds (default: 30000)
- `ENABLE_SERVER_CACHE`: Enable/disable server-side caching (default: false)

## Integration Ideas

### Display Options

1. **Count Display**: Show total counts of nearby bikes/scooters
   ```
   🚲 15 bikes nearby
   🛴 8 scooters nearby
   ```

2. **Provider Breakdown**: Show availability by provider
   ```
   Citi Bike: 12 bikes
   Lime: 5 scooters
   Bird: 3 scooters
   ```

3. **Station Information**: Display docking station details
   ```
   Broadway & 42nd St
   5 bikes, 3 e-bikes, 10 docks available
   ```

4. **Integrated View**: Combine with transit departures
   ```
   [Transit departures...]

   Nearby Micromobility:
   🚲 12 bikes  🛴 8 scooters
   ```

### Implementation Considerations

1. **Floating vehicles**: Count by `vehicle_type` to show accurate numbers
2. **Stations**: Parse `description` field (no structured count available)
3. **Refresh rate**: 30s cache seems reasonable for micromobility data
4. **Distance**: 500m default is good for walking distance

## Next Steps

To integrate this into the Transit TV display:

1. **Create UI Component**: Design how to show micromobility data alongside transit
2. **Update Config**: Add user settings for enabling/disabling micromobility
3. **Styling**: Match the visual style of transit departure displays
4. **Testing**: Test with various locations to see data quality
5. **Error Handling**: Handle cases where no micromobility data is available

## Testing

To test the API:

1. Set up `.env` with `TRANSIT_API_KEY`
2. Start the server: `npm start`
3. Make a request:
   ```bash
   curl "http://localhost:8080/api/placemarks?lat=40.7589&lon=-73.9851&distance=500"
   ```

Or from the browser console (when app is running):
```javascript
const response = await fetch('/api/placemarks?lat=40.7589&lon=-73.9851&distance=500');
const data = await response.json();
console.log(data);
```

## API Documentation

- Full API docs: https://api-doc.transitapp.com/v4.html#operation//map_layers/placemarks
- Endpoint: `GET /v4/public/map_layers/placemarks`
- Authentication: API key required in `apiKey` header
