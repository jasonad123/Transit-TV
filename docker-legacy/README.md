# Legacy Docker files

This directory contains legacy (pre v1.3.0) Docker-related files for this project. These legacy files have been maintained for compatibility purposes.

For production deployments, we recommend using the Dockerfile located at [./Dockerfile](/Dockerfile) and the Docker Compose file located at [./compose.yaml](/compose.yaml).

## Build using Dockerfile

To build this project using the legacy Dockerfile (starting from the root directory):

```bash

docker build -f docker-legacy/Dockerfile.legacy .
```

## Using Docker Compose

To run this project in Docker Compose using the legacy `compose.yaml` (starting from the root directory):

```bash

# production
docker compose -f docker-legacy/compose.legacy.yaml --profile production up

# development
docker compose -f docker-legacy/compose.legacy.yaml --profile development up

```
