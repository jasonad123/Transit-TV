# Transit TV

A real-time transit display application that shows arrival times for nearby public transit.

![Screenshot](/assets/transit-tv-reloaded-3.png)

<div style="text-align:center">

<img src="https://github.com/jasonad123/Transit-TV/blob/main/assets/transit-api-badge.png?raw=true" width="25%" />

</div>

> [!IMPORTANT]
> This is a _rewrite_ of the original Transit TV application in a more up-to-date stack.
> If you're looking for _my fork_ of the original project, have a look at the [legacy branch](https://github.com/jasonad123/Transit-TV/tree/legacy) of this repo.
> If you're looking for the original project, have a look over on [Transit's account](https://github.com/TransitApp/Transit-TV)

> [!WARNING]  
> Transit TV was built by the Transit team as a fun project to demo the API, usage of this project comes with no guarantee of any kind.
> Just as the original Transit TV was built by the Transit team as a fun project, **_this_** version of this project comes with no guarantee of any kind. I am **not** affiliated with Transit, just big fans of their app.

## Prerequisites

- An API key from Transit - [keys can be requested here](https://transitapp.com/partners/apis)

Optional, for local deployment or development only

- Docker (recommended)
- Node.js (version specified in .node-version, for development/local deployment purposes only)
- pnpm (preferred package manager, for development/local deployment purposes only)

## Getting started

> [!TIP]
> If you just want to deploy Transit TV, skip these steps and follow the instructions on the [Deployment](https://github.com/jasonad123/Transit-TV/wiki/Deployment) page for all available options, including a one-click deployment option.

1. Request API access

Go to the [Transit API page](https://transitapp.com/partners/apis) and request access to the API. When you have the API key, you can place it in your environment `.env` file or however variables/secrets are managed.

2. Create your `.env` files

For testing/deployment with `pnpm` or Docker:

```bash
# create .env for local deployment with pnpm or Docker
cp .env.example .env
```

## Deployment with Docker (recommended)

1. **Configure environment variables:**

   ```bash
   # Review and edit .env file with your API key
   nano .env
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
   docker build -f Dockerfile .

   # Run the container
   docker run -p 8080:8080 --env-file .env transit-tv-svelte
   ```

The application will be available at http://localhost:8080

## Configuration

You can configure the application using environment variables:

- `NODE_ENV`: Set to `production` for production deployment
- `PORT`: The port the application will listen on (default: 8080)
- `TRANSIT_API_KEY`: Your Transit API key
- `SESSION_SECRET`: Secret for session encryption
- `ALLOWED_ORIGINS`: (Development only) Comma-separated list of allowed CORS origins

### Unattended Setup

This feature allows you to skip the configuration popup on first launch - automatically setting your location, title, language, clock format, and other preferences. You'll still be able to change the settings at any time through the UI.

To use unattended setup, simply modify your relevant `.env` file or environment variables depending on your deployment method.

Please review the `.env.example` file and the [Unattended Setup documentation](https://github.com/jasonad123/Transit-TV/wiki/Unattended-Setup) for more information on all available options.

### Theming

Transit TV supports changing the header colour to match your organization's branding and displaying your organization's logo alongside the "Powered by Transit" logo in the header.
The logo feature feature works with both external URLs and local file paths. Both features are configurable in Unattended Setup for scalability.

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

### Caching

This app includes configurable client-side and server-side caching to reduce the number of calls to the Transit API.
Please review the `.env.example` file to view all available caching options.

## Development/advanced configuration

### Local testing/deployment (advanced users only)

1. Follow the **getting started** steps

This includes getting an API key from Transit and setting up the `.env` file and cloning this repo locally.

2. Build and run locally

```bash
# Install dependencies
pnpm i

# Build the SvelteKit app
cd svelte-app && pnpm build && cd ..
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

#### CORS Configuration (advanced)

**Note:** CORS is automatically disabled in production deployments. In production, SvelteKit and Express run on the same origin (port 8080), so cross-origin requests don't occur and CORS headers are not needed.

CORS is only enabled during local development when running SvelteKit dev server (port 5173) separately from the Express backend (port 8080).

For development, the default allowed origin is `http://localhost:5173`. If you need to allow additional origins during development:

```bash
# Development only - allow SvelteKit dev server
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8080
```

**Production deployments do not require ALLOWED_ORIGINS configuration.** Each deployment is self-contained and serves both frontend and backend on the same origin.

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
├── Dockerfile            # Docker build file
├── compose.yaml          # Docker Compose file (production)
└── compose.dev.yaml      # Docker Compose (development)
```

## License

See the [LICENSE](LICENSE) file for details.

## Additional Disclaimers

> [!NOTE]
> **Generative AI:** The code for this project was developed with the help of generative AI tools, including Claude and Claude Code. While all outputs have been _lovingly_ reviewed and tested, users should validate results independently before use in production environments.
