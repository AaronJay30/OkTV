# Docker Setup for OKtv

This application can be run using Docker, which provides a consistent environment across different machines.

## Prerequisites

-   [Docker](https://docs.docker.com/get-docker/)
-   [Docker Compose](https://docs.docker.com/compose/install/) (usually included with Docker Desktop)

## Running with Docker

### Build and Run

To build and run the application in a Docker container:

```bash
# Build and start the container
docker-compose up --build

# Or to run it in the background
docker-compose up --build -d
```

### Stop the Container

To stop the running container:

```bash
docker-compose down
```

## Development with Docker

For development, you can use volume mounts to see changes in real-time:

1. Modify the `docker-compose.yml` file to use the development environment:

```yaml
version: "3"

services:
    web:
        build:
            context: .
            dockerfile: Dockerfile
        ports:
            - "3000:3000"
        volumes:
            - ./:/app
            - /app/node_modules
            - /app/.next
        command: pnpm dev
        environment:
            - NODE_ENV=development
```

2. Run the development container:

```bash
docker-compose -f docker-compose.dev.yml up
```

## Environment Variables

Make sure to set up your environment variables properly. You can:

1. Create a `.env` file in the project root
2. The `.env` file is mounted into the container via the volume in the docker-compose file

## Building for Production

To build the production image:

```bash
docker build -t oktv:latest .
```

To run the production image:

```bash
docker run -p 3000:3000 oktv:latest
```
