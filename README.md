# Transit TV

A real-time transit display application that shows arrival times for nearby public transportation.

![Screenshot](screenshot.png)

[![Powered by Transit API logo](/transit-api-badge.png 'Powered by Transit API logo')](https://transitapp.com)

> [!WARNING]  
> Transit TV was built by the Transit team as a fun project to demo our API, usage of this project comes with no guarantee of any kind. 

> [!WARNING]
> Just as the original Transit TV was built by the Transit team as a fun project, ***this*** version of this project comes with no guarantee of any kind. I am **not** affiliated with Transit, just big fans of their app.


## Prerequisites

- An API key from Transit - [keys can be requested here](https://transitapp.com/apis)[^1]
- Node.js (version specified in .node-version)
- pnpm (preferred package manager)
- Docker (optional, for containerized deployment)

[^1]: Keep in mind that to have a Transit-TV running 24/7 you'll need a paid API key as the free plan won't be enough.

## Development Setup

### Installation

```bash
# Install dependencies
pnpm i
```

### Configuration

1. Create an `.env` file from the example:

```bash
cp .env.example .env
```

2. Edit the `.env` file and add your Transit API key.

### Running Locally

```bash
# Start the development server
pnpm dev
```

The application will be available at http://localhost:7753

### Building for Production

```bash
pnpm build
```
The application will be available at http://localhost:8080

## Docker Deployment

### Using Docker

Build and run the application using Docker:

```bash
# Build the Docker image
docker build -t transit-tv .

# Run the container
docker run -p 8080:8080 -e TRANSIT_API_KEY=your_api_key_here transit-tv
```
The application will be available at http://localhost:8080

### Using Docker Compose

For a more comprehensive deployment with Docker Compose:

1. Configure your environment variables:
   
   ```bash
   # Review and edit .env.docker file with your API key
   nano .env.docker
   ```

2. Run with Docker Compose:

   ```bash
   # Start the application
   docker compose up -d

   # View logs
   docker compose logs -f

   # Stop the application
   docker compose down
   ```

The application will be available at http://localhost:8080

### Environment Variables

When running with Docker, you can configure the application using environment variables:

- `NODE_ENV`: Set to `production` for production deployment
- `PORT`: The port the application will listen on (default: 8080)
- `TRANSIT_API_KEY`: Your Transit API key
- `SESSION_SECRET`: Secret for session encryption

## Project Structure
.
├── client/
│   ├── app/
│   ├── components/
│   ├── directives/
│   └── services/
├── server/
│   ├── api/
│   ├── config/
│   └── components/
├── .env.example
├── .env.docker
├── compose.yml
└── Dockerfile

## Architecture

- `client/`: Frontend code
  - `app/`: Angular.js application
  - `components/`: Reusable components
  - `directives/`: Angular.js directives
  - `services/`: Angular.js services
- `server/`: Backend code
  - `api/`: API endpoints
  - `config/`: Server configuration
  - `components/`: Server components

## License

See the [LICENSE](LICENSE) file for details.
