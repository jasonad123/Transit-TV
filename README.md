# Transit TV

A real-time transit display application that shows arrival times for nearby public transit.

![Screenshot](transit-tv-reloaded-3.png)

<div style="text-align: center;">

[![Powered by Transit API logo](/transit-api-badge.png 'Powered by Transit API logo')](https://transitapp.com)

</div>

> [!IMPORTANT]
> This is a _rewrite_ of the original Transit TV application in a more up-to-date stack.
> If you're looking for _my fork_ of the original project, have a look at the [legacy branch](https://github.com/jasonad123/Transit-TV/tree/legacy) of this repo.
> If you're looking for the original project, have a look over at [Transit App's account](https://github.com/TransitApp/Transit-TV)

> [!WARNING]  
> Transit TV was built by the Transit team as a fun project to demo our API, usage of this project comes with no guarantee of any kind.

> [!IMPORTANT]
> Just as the original Transit TV was built by the Transit team as a fun project, **_this_** version of this project comes with no guarantee of any kind. I am **not** affiliated with Transit, just big fans of their app.

## Prerequisites

- An API key from Transit - [keys can be requested here](https://transitapp.com/apis)
- Node.js (version specified in .node-version)
- pnpm (preferred package manager)
- Docker (optional, for containerized deployment)

## Getting started

1. Request API access

Go to the [Transit API page](https://transitapp.com/apis) and request access to the API. When you have the API key, you can place it in your environment file.

> `.env` for local development using `pnpm`
> `.env.docker` for deployment using docker

2. Create your `.env` files

Depending on if you're deploying using `pnpm` or if you're using Docker, create your `.env` file from an example.

For testing/deployment with `pnpm`:

```bash
# create .env for local deployment with pnpm
cp .env.example .env
```

For testing/deployment with Docker:

```bash
# create .env for local deployment with docker
cp .env.docker.example .env.docker
```

## Local testing/deployment

> [!NOTE]
> This project has been migrated to a new stack built on Svelte and SvelteKit. The legacy version (based on AngularJS) is still available but the SvelteKit version is recommended for most new deployments. The warnings above still apply either way.

1. Follow the **getting started** steps

This includes getting an API key from Transit and setting up the `.env` file and cloning this repo locally.

2. Build and run locally

```bash
# Install dependencies
pnpm i

# Build the SvelteKit app
cd svelte-app && pnpm build && cd ..

# Start the server with SvelteKit
USE_SVELTE=true pnpm start
```

The application will be available at http://localhost:8080

For development with hot reload:

```bash
# Terminal 1: Start SvelteKit dev server
cd svelte-app && pnpm dev

# Terminal 2: Start Express backend
pnpm start
```

Then access the app at http://localhost:5173 (Vite dev server with hot reload)

3. Deploy somewhere!

If all looks good, you should be ready to deploy it.

## Deployment with Docker

1. **Configure environment variables:**

   ```bash
   # Review and edit .env.docker file with your API key
   nano .env.docker
   ```

2. **Using Docker Compose:**

   ```bash
   # Production build
   docker compose up -d

   # View logs
   docker compose logs

   # Stop
   docker compose down
   ```

   For development with hot reload:

   ```bash
   docker compose --profile dev up
   ```

3. **Using Docker build directly:**

   ```bash
   # Build the SvelteKit image
   docker build -f Dockerfile.svelte -t transit-tv-svelte .

   # Run the container
   docker run -p 8080:8080 --env-file .env.docker transit-tv-svelte
   ```

The application will be available at http://localhost:8080

### Environment Variables

When running with Docker, you can configure the application using environment variables:

- `NODE_ENV`: Set to `production` for production deployment
- `PORT`: The port the application will listen on (default: 8080)
- `TRANSIT_API_KEY`: Your Transit API key
- `SESSION_SECRET`: Secret for session encryption
- `ALLOWED_ORIGINS`: (Development only) Comma-separated list of allowed CORS origins

#### CORS Configuration (advanced)

**Note:** CORS is automatically disabled in production deployments. In production, SvelteKit and Express run on the same origin (port 8080), so cross-origin requests don't occur and CORS headers are not needed.

CORS is only enabled during local development when running SvelteKit dev server (port 5173) separately from the Express backend (port 8080).

For development, the default allowed origin is `http://localhost:5173`. If you need to allow additional origins during development:

```bash
# Development only - allow SvelteKit dev server
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8080
```

**Production deployments do not require ALLOWED_ORIGINS configuration.** Each deployment is self-contained and serves both frontend and backend on the same origin.

## Enhancements

### Unattended Setup

This feature allows you to skip the configuration popup on first launch - automatically setting your location, title, language, clock format, and other preferences. You'll still be able to change the settings at any time through the UI.

To use unattended setup, simply modify your relevant `.env` file or environment variables depending on your deployment method (modify them in `.env` for local deployment, `.env.docker` for Docker deployments)

**Available configuration options:**
- **Location**: Latitude and longitude for transit data
- **Title**: Display title for the screen
- **Time Format**: 24-hour (`HH:mm`), 12-hour with AM/PM (`hh:mm A`), or 12-hour without AM/PM (`hh:mm`)
- **Language**: Interface language - English (`en`), French (`fr`), Spanish (`es`), or German (`de`)
- **Theme**: Light, dark, or auto (system preference)
- **Header Color**: Custom hex color for the header
- **Columns**: Number of route columns (auto, 1-5)
- **QR Code**: Show/hide Transit app deeplink QR code
- **Max Distance**: Search radius for nearby routes (250-1500m)
- **Custom Logo**: Your organization's logo URL or path
- **Group Itineraries**: Group routes by parent station (v1.3.0+)
- **Filter Terminus**: Hide redundant terminus entries (v1.3.0+)

Please review the `.env.example` file for detailed documentation of all available options.

### Custom Logo

Transit TV supports displaying your organization's logo alongside the "Powered by Transit" logo in the header. This feature works with both external URLs and local file paths.

**Using external URLs:**

Set the `UNATTENDED_CUSTOM_LOGO` environment variable to your logo URL:

```bash
UNATTENDED_CUSTOM_LOGO=https://example.com/logo.png
```

**Using local files with Docker:**

1. Mount your logo file to the container's static assets directory:

   ```yaml
   volumes:
     - ./path/to/your/logo.png:/app/svelte-app/static/assets/images/logo.png:ro
   ```

2. Set the environment variable to the mounted path:

   ```bash
   UNATTENDED_CUSTOM_LOGO=/assets/images/logo.png
   ```

See [compose.yaml](compose.yaml) for volume mount examples.

### Stop Grouping (v1.3.0+)

Transit TV can group multiple route branches that serve the same parent station together on a single card. This is useful for transit systems where multiple route variants (e.g., "North to Downtown" and "North to Airport") share the same stop but have different destinations.

**Enable stop grouping:**

```bash
UNATTENDED_GROUP_ITINERARIES=true
```

**When enabled:**
- Routes serving the same parent station are visually grouped together
- Multiple destinations appear on a single card with shared stop name
- Cleaner display for complex transit systems with many route variants

**Best for:** Metro systems, regional rail networks, and bus systems with multiple route branches

### Terminus Filtering (v1.3.0+)

When you're located at or near a terminus station, Transit TV can filter out redundant destination entries. For example, if you're already at "Waterfront Station", the display won't show "North to Waterfront" since you're already there.

**Enable terminus filtering:**

```bash
UNATTENDED_FILTER_TERMINUS=true
```

**When enabled:**
- Automatically hides destinations for the station you're currently at
- Reduces clutter on the display
- Shows only relevant outbound/opposite direction departures

**Best for:** End-of-line stations, major terminals, and turnaround points

### Health Check Endpoint (v1.3.0+)

Transit TV now includes a `/health` endpoint for monitoring and container orchestration:

```bash
curl http://localhost:8080/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-18T16:00:00.000Z",
  "version": "1.3.0",
  "uptime": 3600,
  "environment": "production"
}
```

This endpoint is used by Docker Compose health checks and can be integrated with monitoring tools like Prometheus, Datadog, or your cloud provider's health check system.

## Project structure

```bash
.
├── svelte-app/           # SvelteKit application
│   ├── src/
│   │   ├── routes/       # SvelteKit routes and API endpoints
│   │   ├── lib/          # Components, stores, utilities
│   │   └── app.css       # Global styles
│   ├── static/           # Static assets like images and fonts
│   └── package.json      # SvelteKit dependencies
├── server/
│   ├── api/              # API endpoints
│   ├── config/           # Server configuration
│   ├── components/       # Custom server components
│   └── routes.js         # Express routing
├── .env.example          # Example environment variables
├── .railway-env-template # Example environment variables for Railway deployments
├── Dockerfile            # Docker build file
├── compose.yaml          # Docker Compose file (production)
└── compose.dev.yaml      # Docker Compose (development)
```

## License

See the [LICENSE](LICENSE) file for details.

## Additional Disclaimers

> [!NOTE]
> **Generative AI:** The code for this project was developed with the help of generative AI tools, including Claude and Claude Code. While all outputs have been _lovingly_ reviewed and tested, users should validate results independently before use in production environments.
