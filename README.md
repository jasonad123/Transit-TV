# Transit TV

A real-time transit display application that shows arrival times for nearby public transportation.

![Screenshot](screenshot.png)

[![Powered by Transit API logo](/transit-api-badge.png 'Powered by Transit API logo')](https://transitapp.com)

> [!WARNING]  
> Transit TV was built by the Transit team as a fun project to demo our API, usage of this project comes with no guarantee of any kind. 

> [!WARNING]
> Just as the original Transit TV was built by the Transit team as a fun project, ***this*** version of this project comes with no guarantee of any kind. I am **not** affiliated with Transit, just big fans of their app.

## Prerequisites

- An API key from Transit - [keys can be requested here](https://transitapp.com/apis)
  - Keep in mind that to have a Transit-TV running 24/7 you'll need a paid API key as the free plan won't be enough.
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

### SvelteKit Version (Recommended)

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

### Legacy AngularJS Version

```bash
# Install dependencies
pnpm i
pnpm build
pnpm start
```
The application will be available at http://localhost:8080

3. Deploy somewhere!

If all looks good, you should be ready to deploy somewhere if you want to use it for a longer amount of time.

## Deployment with Docker

### SvelteKit Version (Recommended)

1. **Configure environment variables:**

   ```bash
   # Review and edit .env.docker file with your API key
   nano .env.docker
   ```

2. **Using Docker Compose:**

   ```bash
   # Production build
   docker compose -f compose.svelte.yml --profile production up -d

   # View logs
   docker compose -f compose.svelte.yml logs -f

   # Stop
   docker compose -f compose.svelte.yml down
   ```

   For development with hot reload:
   ```bash
   docker compose -f compose.svelte.yml --profile dev up
   ```

3. **Using Docker build directly:**

   ```bash
   # Build the SvelteKit image
   docker build -f Dockerfile.svelte -t transit-tv-svelte .

   # Run the container
   docker run -p 8080:8080 --env-file .env.docker transit-tv-svelte
   ```

The application will be available at http://localhost:8080

### Legacy AngularJS Version

**Using Docker Compose:**

   ```bash
   # Review and edit .env.docker file
   nano .env.docker

   # Start the application
   docker compose up -d

   # View logs
   docker compose logs -f

   # Stop the application
   docker compose down
   ```

**Using Docker run:**

```bash
# Build the Docker image
docker build -t transit-tv .

# Run the container
docker run -p 8080:8080 --env-file .env.docker transit-tv
```

The application will be available at http://localhost:8080

### Environment Variables

When running with Docker, you can configure the application using environment variables:

- `NODE_ENV`: Set to `production` for production deployment
- `PORT`: The port the application will listen on (default: 8080)
- `TRANSIT_API_KEY`: Your Transit API key
- `SESSION_SECRET`: Secret for session encryption
- `ALLOWED_ORIGINS`: Comma-separated list of allowed CORS origins (default: `http://localhost:8080`)

#### CORS Configuration

The application implements CORS (Cross-Origin Resource Sharing) to control which domains can access the API from web browsers. By default, only `http://localhost:8080` is allowed.

To allow additional domains:

```bash
# Single domain
ALLOWED_ORIGINS=https://yourdomain.com

# Multiple domains (comma-separated)
ALLOWED_ORIGINS=http://localhost:8080,https://yourdomain.com,https://staging.yourdomain.com
```

**Important:** Always specify the full URL including protocol (`http://` or `https://`) and port if non-standard.

## Enhancements

### Unattended Setup

This feature allows you to skip the configuration popup on first launch - automatically setting your location, title, and clock setting. You'll still be able to change the settings at any time.

To use unattended setup, simply modify your relevant `.env` file or environment variables depending on your deployment method (modify them in `.env` for local deployment, `.env.docker` for Docker deployments)

The following variables are available:

```
# UNATTENDED_SETUP: Enable automatic setup without user interaction (true/false)
UNATTENDED_SETUP=false

# UNATTENDED_LOCATION: Latitude and longitude coordinates for transit data
# Format: "latitude,longitude" (e.g., "40.7240,-74.0002" for New York City)
UNATTENDED_LOCATION=

# UNATTENDED_TITLE: Display title for the transit screen
UNATTENDED_TITLE=Transit Display

# UNATTENDED_TIME_FORMAT: Time display format
# Options: "HH:mm" (24-hour format) or "hh:mm A" (12-hour format with AM/PM)
UNATTENDED_TIME_FORMAT=HH:mm
```


## Project structure

```
.
├── svelte-app/           # SvelteKit application (recommended)
│   ├── src/
│   │   ├── routes/       # SvelteKit routes and API endpoints
│   │   ├── lib/          # Components, stores, utilities
│   │   └── app.css       # Global styles
│   └── package.json      # SvelteKit dependencies
├── client/               # Legacy AngularJS application
│   ├── app/              # Main application code
│   ├── components/       # Reusable UI components
│   ├── directives/       # Angular directives
│   └── services/         # Angular services
├── server/
│   ├── api/              # API endpoints
│   ├── config/           # Server configuration
│   └── routes.js         # Express routing (handles both apps)
├── .env.example          # Example environment variables
├── .env.docker           # Docker environment variables (not committed)
├── Dockerfile            # Legacy AngularJS Docker build
├── Dockerfile.svelte     # SvelteKit Docker build (recommended)
├── compose.yml           # Legacy Docker Compose
└── compose.svelte.yml    # SvelteKit Docker Compose (recommended)
```

## License

See the [LICENSE](LICENSE) file for details.

## Disclaimers

> [!NOTE]
> **Generative AI:** The code for this project was developed with the help of generative AI tools, including Claude and Claude Code. While all outputs have been *lovingly* reviewed and tested, users should validate results independently before use in production environments.
