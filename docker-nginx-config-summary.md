# Docker & Nginx Configuration Summary
**Generated for Debugging Reference**

---

## Table of Contents
1. [Current Docker Compose](#current-docker-compose)
2. [Old Docker Compose](#old-docker-compose)
3. [Nginx Configuration](#nginx-configuration)
4. [Backend Dockerfile](#backend-dockerfile)
5. [Frontend Dockerfile](#frontend-dockerfile)
6. [Architecture Overview](#architecture-overview)
7. [Service Ports & Connections](#service-ports--connections)
8. [Environment Variables](#environment-variables)

---

## Current Docker Compose
**File:** `docker-compose.yml`

```yaml
version: "3.9"

services:

  reverse-proxy:
    image: nginx:alpine
    container_name: amtemeterai-reverse-proxy
    restart: always
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - frontend
      - api

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    image: amtemeterai-frontend:v1
    container_name: amtemeterai-frontend
    restart: always

  api:
    build:
      context: ./backend/amtemeterai.Api
      dockerfile: Dockerfile
    image: amtemeterai-api:v1
    container_name: amtemeterai-api
    restart: always
    environment:
      ASPNETCORE_ENVIRONMENT: Production

      ConnectionStrings__DefaultConnection: Host=postgres;Port=5432;Database=opexdb;Username=postgres;Password=postgres

      Jwt__Key: af326aa84d2198e82c5a8dce01f26d96cb29539d3c92e8028f10b58aa3df7204
      Jwt__Issuer: amtemeterai-api
      Jwt__Audience: amtemeterai-web

      App__PublicBaseUrl: http://localhost

    depends_on:
      - postgres

  postgres:
    image: postgres:16
    container_name: amtemeterai-postgres
    restart: always
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: opexdb
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

---

## Old Docker Compose
**File:** `docker-compose-Old.yml`

```yaml
services:
  postgres:
    image: postgres:16
    container_name: amtemeterai_db
    restart: always
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: opexdb
    ports:
      - "5500:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  api:
    build: ./backend/amtemeterai.Api
    container_name: amtemeterai_api
    restart: always
    depends_on:
      - postgres
    ports:
      - "8080:8080"
    environment:
      ConnectionStrings__DefaultConnection: Host=postgres;Port=5432;Database=opexdb;Username=postgres;Password=postgres

  frontend:
    build: ./frontend
    container_name: amtemeterai_frontend
    restart: always
    depends_on:
      - api
    ports:
      - "3000:5173"   # external 3000, internal 5173
    profiles: ["full"]

volumes:
  pgdata:
```

---

## Nginx Configuration
**File:** `nginx.conf`

```nginx
events {}

http {

    upstream frontend {
        server frontend:80;
    }

    upstream api {
        server api:8080;
    }

    server {

        listen 80;

        client_max_body_size 50M;

        location / {
            proxy_pass http://frontend;
        }

        location /api/ {
            proxy_pass http://api;
        }
    }
}
```

---

## Backend Dockerfile
**File:** `backend/amtemeterai.Api/Dockerfile`

```dockerfile
# =========================
# BUILD STAGE
# =========================
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build

WORKDIR /src

COPY . .

RUN dotnet restore

RUN dotnet publish -c Release -o /app/publish

# =========================
# RUNTIME STAGE
# =========================
FROM mcr.microsoft.com/dotnet/aspnet:8.0

WORKDIR /app

COPY --from=build /app/publish .

EXPOSE 8080

ENTRYPOINT ["dotnet", "amtemeterai.Api.dll"]
```

---

## Frontend Dockerfile
**File:** `frontend/Dockerfile`

```dockerfile
# =========================
# BUILD STAGE
# =========================
FROM node:20 AS build

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

# =========================
# RUNTIME STAGE
# =========================
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
```

---

## Old Backend Dockerfile
**File:** `backend/amtemeterai.Api/DockerfileOld`

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY . .

RUN dotnet restore amtemeterai.Api.csproj
RUN dotnet publish amtemeterai.Api.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app

COPY --from=build /app/publish .

EXPOSE 8080

ENTRYPOINT ["dotnet","amtemeterai.Api.dll"]
```

---

## Old Frontend Dockerfile
**File:** `frontend/DockerfileOld`

```dockerfile
FROM node:20

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Host (Port 80)                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │   Nginx (Alpine)    │
              │  amtemeterai-       │
              │  reverse-proxy      │
              └─────────┬───────────┘
                        │
         ┌──────────────┴──────────────┐
         │                             │
         ▼                             ▼
┌─────────────────┐           ┌─────────────────┐
│   Frontend      │           │      API        │
│   (Nginx Alpine)│           │  (ASP.NET 8.0)  │
│   Port: 80      │           │   Port: 8080    │
│   Static files  │           │                 │
│   from /dist    │           │                 │
└─────────────────┘           └────────┬────────┘
                                       │
                                       ▼
                              ┌─────────────────┐
                              │    PostgreSQL    │
                              │      16          │
                              │   Port: 5432     │
                              │   DB: opexdb     │
                              └─────────────────┘
```

---

## Service Ports & Connections

### External Access (Host → Container)

| Service        | Container Name           | External Port | Internal Port |
|----------------|--------------------------|---------------|---------------|
| Nginx          | amtemeterai-reverse-proxy| 80            | 80            |
| API (old)      | amtemeterai_api          | 8080          | 8080          |
| Frontend (old) | amtemeterai_frontend     | 3000          | 5173          |
| PostgreSQL (old)| amtemeterai_db          | 5500          | 5432          |

### Internal Docker Network (Container → Container)

| From Service | To Service | Protocol | Port |
|--------------|------------|----------|------|
| Nginx        | Frontend   | HTTP     | 80   |
| Nginx        | API        | HTTP     | 8080 |
| API          | PostgreSQL | TCP      | 5432 |

---

## Environment Variables

### API Service (`amtemeterai-api`)

| Variable                                    | Value                                      |
|---------------------------------------------|--------------------------------------------|
| `ASPNETCORE_ENVIRONMENT`                    | Production                                 |
| `ConnectionStrings__DefaultConnection`      | Host=postgres;Port=5432;Database=opexdb;Username=postgres;Password=postgres |
| `Jwt__Key`                                  | af326aa84d2198e82c5a8dce01f26d96cb29539d3c92e8028f10b58aa3df7204 |
| `Jwt__Issuer`                               | amtemeterai-api                            |
| `Jwt__Audience`                             | amtemeterai-web                            |
| `App__PublicBaseUrl`                        | http://localhost                           |

### PostgreSQL Service (`amtemeterai-postgres`)

| Variable          | Value     |
|-------------------|-----------|
| `POSTGRES_USER`   | postgres  |
| `POSTGRES_PASSWORD`| postgres  |
| `POSTGRES_DB`     | opexdb    |

---

## Key Differences: Current vs Old Config

| Aspect                | Current (`docker-compose.yml`) | Old (`docker-compose-Old.yml`) |
|-----------------------|--------------------------------|--------------------------------|
| Reverse Proxy         | Yes (Nginx on port 80)         | No                             |
| Frontend Build        | Multi-stage (Node → Nginx)     | Single-stage (dev mode)       |
| Frontend Internal Port| 80 (Nginx serving static)      | 5173 (Vite dev server)        |
| Frontend External Port| None (only via reverse proxy)  | 3000                           |
| PostgreSQL External   | No (internal only)            | Yes (5500:5432)                |
| Frontend Profile      | None                           | Requires `--profile full`      |

---

## Routing Rules (Nginx)

| Request Path | Destination Service |
|--------------|---------------------|
| `/`          | Frontend (port 80)  |
| `/api/*`     | API (port 8080)     |

---

## Build Images

### Current Images
- `amtemeterai-frontend:v1` - From `frontend/Dockerfile`
- `amtemeterai-api:v1` - From `backend/amtemeterai.Api/Dockerfile`

### Base Images Used
- `nginx:alpine` - Reverse proxy & frontend runtime
- `mcr.microsoft.com/dotnet/sdk:8.0` - Backend build stage
- `mcr.microsoft.com/dotnet/aspnet:8.0` - Backend runtime
- `postgres:16` - Database
- `node:20` - Frontend build stage

---

## Docker Volumes

| Volume Name      | Usage                             |
|------------------|-----------------------------------|
| `postgres_data`  | PostgreSQL data persistence       |
| `pgdata` (old)   | Old PostgreSQL volume (deprecated) |

---

## Docker Commands Reference

### Build and Run (Current Config)
```bash
# Build all services
docker-compose build

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Stop services and remove volumes
docker-compose down -v
```

### Access Individual Services
```bash
# View nginx logs
docker logs amtemeterai-reverse-proxy

# View api logs
docker logs amtemeterai-api

# View frontend logs
docker logs amtemeterai-frontend

# View postgres logs
docker logs amtemeterai-postgres

# Access container shell
docker exec -it amtemeterai-api sh
docker exec -it amtemeterai-reverse-proxy sh
```

---

## Common Debugging Commands

```bash
# Check all running containers
docker ps

# Check container networks
docker network inspect amtemeterai_default

# Test nginx configuration
docker exec amtemeterai-reverse-proxy nginx -t

# Test connectivity between containers
docker exec amtemeterai-api wget -O- http://postgres:5432
docker exec amtemeterai-reverse-proxy wget -O- http://frontend:80
docker exec amtemeterai-reverse-proxy wget -O- http://api:8080

# Check postgres connection
docker exec -it amtemeterai-postgres psql -U postgres -d opexdb
```

---

## File Locations

| File                           | Path                                           |
|--------------------------------|------------------------------------------------|
| Current Docker Compose         | `./docker-compose.yml`                         |
| Old Docker Compose             | `./docker-compose-Old.yml`                     |
| Nginx Config                   | `./nginx.conf`                                 |
| Backend Dockerfile             | `./backend/amtemeterai.Api/Dockerfile`        |
| Frontend Dockerfile            | `./frontend/Dockerfile`                        |
| Old Backend Dockerfile         | `./backend/amtemeterai.Api/DockerfileOld`     |
| Old Frontend Dockerfile        | `./frontend/DockerfileOld`                     |
