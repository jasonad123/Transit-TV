# Transit TV Systemd Service Templates

This directory contains systemd service and timer templates for managing Transit TV with automated graceful shutdown and startup scheduling.

## Overview

These templates use Transit TV's built-in graceful shutdown and startup API to manage the application without stopping the HTTP server. This allows for:

- Scheduled start/stop of Transit API polling (e.g., office hours only)
- HTTP server remains accessible for management and status checks
- Graceful handling of API states without process restarts

## Deployment Types

This directory includes templates for **two deployment scenarios**:

### Docker Deployment (Recommended)
Use the `-docker` suffixed files if you're running Transit TV via Docker Compose:
- `transit-tv-shutdown-docker.service` / `transit-tv-shutdown-docker.timer`
- `transit-tv-start-docker.service` / `transit-tv-start-docker.timer`

These use `docker exec` to run commands inside the container, which is required because:
1. The API's security check only accepts requests from localhost
2. When calling from the host through port mapping, the container sees the Docker gateway IP, not localhost
3. Running commands inside the container bypasses this restriction

### Bare Metal Deployment
Use the non-suffixed files if you're running Transit TV directly on the host:
- `transit-tv.service` - Main application service (bare metal only)
- `transit-tv-shutdown.service` / `transit-tv-shutdown.timer`
- `transit-tv-start.service` / `transit-tv-start.timer`

## Files Included

### Docker Deployment Files

- `transit-tv-shutdown-docker.service` - Calls graceful shutdown API via `docker exec`
- `transit-tv-start-docker.service` - Calls graceful start API via `docker exec`
- `transit-tv-shutdown-docker.timer` - Schedules automatic shutdown (default: 6:00 PM Mon-Fri)
- `transit-tv-start-docker.timer` - Schedules automatic startup (default: 8:00 AM Mon-Fri)

### Bare Metal Deployment Files

- `transit-tv.service` - Main application service that runs the Transit TV Node.js server
- `transit-tv-shutdown.service` - Calls graceful shutdown API endpoint directly
- `transit-tv-start.service` - Calls graceful start API endpoint directly
- `transit-tv-shutdown.timer` - Schedules automatic shutdown (default: 6:00 PM Mon-Fri)
- `transit-tv-start.timer` - Schedules automatic startup (default: 8:00 AM Mon-Fri)

## Prerequisites

### For Docker Deployment
1. Docker and Docker Compose installed
2. Transit TV running via `docker compose up -d` (using the provided compose.yaml)
3. Container name is `transit-tv` (default in compose.yaml)
4. No additional dependencies needed (uses wget inside Alpine container)

### For Bare Metal Deployment
1. Node.js >= 24.0.0 installed
2. Transit TV installed in `/opt/transit-tv` (or adjust paths in service files)
3. Dedicated system user `transitv` (or adjust user in service files)
4. curl installed (used by shutdown/start services)

## Installation

Choose the appropriate installation method based on your deployment type.

### Docker Deployment Installation

#### 1. Ensure Docker Container is Running

```bash
# Start Transit TV via Docker Compose
cd /path/to/transit-tv
docker compose up -d

# Verify container is running
docker ps | grep transit-tv
```

#### 2. Customize Timer Schedules (Optional)

Edit the timer files to match your desired schedule:
- `transit-tv-start-docker.timer` - Change `OnCalendar=Mon-Fri 08:00:00` to your desired start time
- `transit-tv-shutdown-docker.timer` - Change `OnCalendar=Mon-Fri 18:00:00` to your desired shutdown time

#### 3. Install Systemd Files

```bash
# Copy Docker-specific service and timer files
sudo cp systemd/transit-tv-shutdown-docker.service /etc/systemd/system/
sudo cp systemd/transit-tv-start-docker.service /etc/systemd/system/
sudo cp systemd/transit-tv-shutdown-docker.timer /etc/systemd/system/
sudo cp systemd/transit-tv-start-docker.timer /etc/systemd/system/

# Set correct permissions
sudo chmod 644 /etc/systemd/system/transit-tv-*-docker.service
sudo chmod 644 /etc/systemd/system/transit-tv-*-docker.timer

# Reload systemd
sudo systemctl daemon-reload
```

#### 4. Enable and Start Timers

```bash
# Enable and start the timers
sudo systemctl enable transit-tv-start-docker.timer
sudo systemctl start transit-tv-start-docker.timer

sudo systemctl enable transit-tv-shutdown-docker.timer
sudo systemctl start transit-tv-shutdown-docker.timer

# Verify timers are active
sudo systemctl list-timers transit-tv-*
```

#### 5. Test Manual Operations (Optional)

```bash
# Manually trigger graceful shutdown
sudo systemctl start transit-tv-shutdown-docker.service

# Check status (should show isShutdown: true)
docker exec transit-tv wget -q -O- http://localhost:8080/api/server/status

# Manually trigger graceful start
sudo systemctl start transit-tv-start-docker.service

# View logs
sudo journalctl -u transit-tv-shutdown-docker.service -n 20
sudo journalctl -u transit-tv-start-docker.service -n 20
```

---

### Bare Metal Deployment Installation

#### 1. Create System User

```bash
sudo useradd -r -s /bin/false -d /opt/transit-tv transitv
```

#### 2. Install Transit TV

```bash
# Clone repository
sudo git clone https://github.com/jasonad123/Transit-TV.git /opt/transit-tv
cd /opt/transit-tv

# Install dependencies
sudo -u transitv pnpm install
sudo -u transitv pnpm build

# Set up environment file
sudo cp .env.example .env
sudo chown transitv:transitv .env
sudo chmod 600 .env

# Edit .env with your configuration
sudo nano .env
```

#### 3. Customize Service Files (Optional)

If your installation path differs from `/opt/transit-tv`, update these files:

- `transit-tv.service`: Update `WorkingDirectory`, `EnvironmentFile`, and `ExecStart` paths
- `transit-tv-shutdown.service`: Update port if not using 8080
- `transit-tv-start.service`: Update port if not using 8080

To change the scheduled times, edit the timer files:

- `transit-tv-start.timer`: Change `OnCalendar=Mon-Fri 08:00:00` to desired time
- `transit-tv-shutdown.timer`: Change `OnCalendar=Mon-Fri 18:00:00` to desired time

#### 4. Install Systemd Files

```bash
# Copy bare metal service files (NOT the -docker versions)
sudo cp systemd/transit-tv.service /etc/systemd/system/
sudo cp systemd/transit-tv-shutdown.service /etc/systemd/system/
sudo cp systemd/transit-tv-start.service /etc/systemd/system/
sudo cp systemd/transit-tv-shutdown.timer /etc/systemd/system/
sudo cp systemd/transit-tv-start.timer /etc/systemd/system/

# Set correct permissions
sudo chmod 644 /etc/systemd/system/transit-tv.service
sudo chmod 644 /etc/systemd/system/transit-tv-shutdown.service
sudo chmod 644 /etc/systemd/system/transit-tv-start.service
sudo chmod 644 /etc/systemd/system/transit-tv-shutdown.timer
sudo chmod 644 /etc/systemd/system/transit-tv-start.timer

# Reload systemd
sudo systemctl daemon-reload
```

#### 5. Enable and Start Main Service

```bash
# Enable service to start on boot
sudo systemctl enable transit-tv.service

# Start the service
sudo systemctl start transit-tv.service

# Check status
sudo systemctl status transit-tv.service
```

#### 6. Enable and Start Timers

```bash
# Enable start timer
sudo systemctl enable transit-tv-start.timer
sudo systemctl start transit-tv-start.timer

# Enable shutdown timer
sudo systemctl enable transit-tv-shutdown.timer
sudo systemctl start transit-tv-shutdown.timer

# Check timer status
sudo systemctl list-timers transit-tv-*
```

#### 7. Test Manual Operations (Optional)

```bash
# Manually trigger graceful shutdown (pauses Transit API polling)
sudo systemctl start transit-tv-shutdown.service

# Manually trigger graceful start (resumes Transit API polling)
sudo systemctl start transit-tv-start.service

# Restart main application
sudo systemctl restart transit-tv.service

# View logs
sudo journalctl -u transit-tv.service -f
sudo journalctl -u transit-tv-shutdown.service
sudo journalctl -u transit-tv-start.service
```

---

## Usage Quick Reference

### Docker Deployment

```bash
# Manual operations
sudo systemctl start transit-tv-shutdown-docker.service  # Shutdown
sudo systemctl start transit-tv-start-docker.service     # Start

# Check status
docker exec transit-tv wget -q -O- http://localhost:8080/api/server/status

# View timer status
sudo systemctl list-timers transit-tv-*

# View logs
sudo journalctl -u transit-tv-shutdown-docker.service -n 20
sudo journalctl -u transit-tv-start-docker.service -n 20
```

### Bare Metal Deployment

```bash
# Manual operations
sudo systemctl start transit-tv-shutdown.service  # Shutdown
sudo systemctl start transit-tv-start.service     # Start
sudo systemctl restart transit-tv.service         # Restart app

# Check status
curl http://localhost:8080/api/server/status

# View timer status
sudo systemctl list-timers transit-tv-*

# View logs
sudo journalctl -u transit-tv.service -f
sudo journalctl -u transit-tv-shutdown.service -n 20
sudo journalctl -u transit-tv-start.service -n 20
```

## How It Works

### Graceful Shutdown

When `transit-tv-shutdown.service` runs (manually or via timer):

1. Calls `POST http://localhost:8080/api/server/shutdown`
2. Transit TV pauses Transit API polling
3. HTTP server remains running
4. Frontend displays "Server is shutdown" message
5. Status checks and management endpoints remain accessible

### Graceful Start

When `transit-tv-start.service` runs (manually or via timer):

1. Calls `POST http://localhost:8080/api/server/start`
2. Transit TV resumes Transit API polling
3. Frontend resumes normal operation
4. Transit data updates begin again

### Main Service

The `transit-tv.service`:

- Runs the Node.js application continuously
- Restarts automatically on failure
- Includes security hardening options
- Logs to systemd journal

## Security Notes

- Shutdown/start API endpoints only accept requests from localhost in production
- Docker bridge network (172.17.0.0/16) is also allowed for container deployments
- **Docker deployment**: Using `docker exec` runs commands inside the container as localhost, bypassing IP restrictions
- **Bare metal deployment**: Service files include systemd security hardening options
- Environment file should have restricted permissions (600)

## Troubleshooting

### Check if timers are enabled

```bash
sudo systemctl list-timers transit-tv-*
```

### View detailed timer information

**Docker:**
```bash
sudo systemctl status transit-tv-start-docker.timer
sudo systemctl status transit-tv-shutdown-docker.timer
```

**Bare Metal:**
```bash
sudo systemctl status transit-tv-start.timer
sudo systemctl status transit-tv-shutdown.timer
```

### Check service logs

**Docker:**
```bash
# Shutdown action logs
sudo journalctl -u transit-tv-shutdown-docker.service -n 20

# Start action logs
sudo journalctl -u transit-tv-start-docker.service -n 20

# Docker container logs
docker logs transit-tv -f
```

**Bare Metal:**
```bash
# Main service logs
sudo journalctl -u transit-tv.service -n 50

# Shutdown action logs
sudo journalctl -u transit-tv-shutdown.service -n 20

# Start action logs
sudo journalctl -u transit-tv-start.service -n 20
```

### Test API endpoints manually

**Docker:**
```bash
# Check server status
docker exec transit-tv wget -q -O- http://localhost:8080/api/server/status

# Trigger shutdown
docker exec transit-tv wget -q -O- --post-data='' http://localhost:8080/api/server/shutdown

# Trigger start
docker exec transit-tv wget -q -O- --post-data='' http://localhost:8080/api/server/start
```

**Bare Metal:**
```bash
# Check server status
curl http://localhost:8080/api/server/status

# Trigger shutdown
curl -X POST http://localhost:8080/api/server/shutdown

# Trigger start
curl -X POST http://localhost:8080/api/server/start
```

### Common Issues

**Docker Deployment:**
1. **Container not running**: Check `docker ps | grep transit-tv`, start with `docker compose up -d`
2. **Container name mismatch**: Verify container is named `transit-tv` (see Customization section)
3. **API calls fail from host**: Don't use direct curl from host, use `docker exec` instead
4. **Timer not running**: Ensure both timer and service files are enabled
5. **Port mapping issue**: Verify compose.yaml has `ports: - "8080:8080"`

**Bare Metal Deployment:**
1. **Service fails to start**: Check that Node.js >= 24.0.0 is installed and .env file exists
2. **Permission denied**: Ensure transitv user has read access to all application files
3. **Port already in use**: Check if another service is using port 8080
4. **Timer not running**: Ensure both timer and service files are enabled
5. **API calls fail**: Verify main service is running and port is correct

## Customization

### Docker: Different Container Name

If your container has a different name (not `transit-tv`), edit the Docker service files:

Edit `transit-tv-shutdown-docker.service` and `transit-tv-start-docker.service`:

```ini
# Replace 'transit-tv' with your container name
ExecStart=/usr/bin/docker exec YOUR_CONTAINER_NAME wget -q -O- --post-data='' http://localhost:8080/api/server/shutdown
```

### Docker: Different Port

If your container uses a different internal port, edit the Docker service files:

Edit `transit-tv-shutdown-docker.service` and `transit-tv-start-docker.service`:

```ini
ExecStart=/usr/bin/docker exec transit-tv wget -q -O- --post-data='' http://localhost:YOUR_PORT/api/server/shutdown
```

### Bare Metal: Different User or Paths

Edit `transit-tv.service`:

```ini
User=your_user
Group=your_group
WorkingDirectory=/your/path
```

### Bare Metal: Different Port

Edit `transit-tv-shutdown.service` and `transit-tv-start.service`:

```ini
ExecStart=/usr/bin/curl -f -X POST http://localhost:YOUR_PORT/api/server/shutdown
```

### Different Schedule (Both Deployments)

Edit timer files, using systemd calendar format:

```ini
# Examples:
OnCalendar=*-*-* 08:00:00          # Every day at 8 AM
OnCalendar=Mon,Wed,Fri 09:00:00    # Mon, Wed, Fri at 9 AM
OnCalendar=hourly                   # Every hour
```

See `man systemd.time` for more calendar format options.

## Migration from Docker Compose Timers

If you were previously using `docker compose up` and `docker compose down` with systemd timers:

### Key Difference

**Old approach**: Timers that run `docker compose up` and `docker compose down` completely start/stop the container

**New approach**: Container stays running 24/7, timers only trigger graceful shutdown/start API calls to pause/resume Transit API polling

### Benefits

1. **Faster operations**: No container startup/shutdown overhead
2. **Better reliability**: HTTP server always accessible for status checks
3. **State preservation**: Application state maintained between pause/resume cycles
4. **Instant management**: Can manually control via API or UI at any time

### Migration Steps

1. **Stop old timers** that run `docker compose up/down`:
   ```bash
   sudo systemctl stop docker-compose-up.timer
   sudo systemctl stop docker-compose-down.timer
   sudo systemctl disable docker-compose-up.timer
   sudo systemctl disable docker-compose-down.timer
   ```

2. **Keep container running**:
   ```bash
   docker compose up -d
   ```

3. **Install new Docker-specific systemd files** (follow Docker Deployment Installation section above)

4. **Keep the same timer schedules**: The new timer files default to 8 AM start and 6 PM shutdown, but you can customize them to match your previous schedule

## References

- [systemd.service documentation](https://www.freedesktop.org/software/systemd/man/systemd.service.html)
- [systemd.timer documentation](https://www.freedesktop.org/software/systemd/man/systemd.timer.html)
- [Transit TV Repository](https://github.com/jasonad123/Transit-TV)
