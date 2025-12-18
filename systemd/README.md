# Transit TV Systemd Service Templates

This directory contains systemd service and timer templates for managing Transit TV with automated graceful shutdown and startup scheduling.

## Overview

These templates use Transit TV's built-in graceful shutdown and startup API to manage the application without stopping the HTTP server. This allows for:

- Scheduled start/stop of Transit API polling (e.g., office hours only)
- HTTP server remains accessible for management and status checks
- Graceful handling of API states without process restarts

## Files Included

### Service Files

- `transit-tv.service` - Main application service that runs the Transit TV Node.js server
- `transit-tv-shutdown.service` - Calls the graceful shutdown API endpoint
- `transit-tv-start.service` - Calls the graceful start API endpoint

### Timer Files

- `transit-tv-start.timer` - Schedules automatic startup (default: 8:00 AM Mon-Fri)
- `transit-tv-shutdown.timer` - Schedules automatic shutdown (default: 6:00 PM Mon-Fri)

## Prerequisites

1. Node.js >= 24.0.0 installed
2. Transit TV installed in `/opt/transit-tv` (or adjust paths in service files)
3. Dedicated system user `transitv` (or adjust user in service files)
4. curl installed (used by shutdown/start services)

## Installation

### 1. Create System User

```bash
sudo useradd -r -s /bin/false -d /opt/transit-tv transitv
```

### 2. Install Transit TV

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

### 3. Customize Service Files (if needed)

If your installation path differs from `/opt/transit-tv`, update these files:

- `transit-tv.service`: Update `WorkingDirectory`, `EnvironmentFile`, and `ExecStart` paths
- `transit-tv-shutdown.service`: Update port if not using 8080
- `transit-tv-start.service`: Update port if not using 8080

To change the scheduled times, edit the timer files:

- `transit-tv-start.timer`: Change `OnCalendar=Mon-Fri 08:00:00` to desired time
- `transit-tv-shutdown.timer`: Change `OnCalendar=Mon-Fri 18:00:00` to desired time

### 4. Install Systemd Files

```bash
# Copy service files
sudo cp systemd/*.service /etc/systemd/system/
sudo cp systemd/*.timer /etc/systemd/system/

# Set correct permissions
sudo chmod 644 /etc/systemd/system/transit-tv*.service
sudo chmod 644 /etc/systemd/system/transit-tv*.timer

# Reload systemd
sudo systemctl daemon-reload
```

## Usage

### Enable and Start Main Service

```bash
# Enable service to start on boot
sudo systemctl enable transit-tv.service

# Start the service
sudo systemctl start transit-tv.service

# Check status
sudo systemctl status transit-tv.service
```

### Enable Automated Timers

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

### Manual Operations

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
- Service files include systemd security hardening options
- Environment file should have restricted permissions (600)

## Troubleshooting

### Check if timers are enabled

```bash
sudo systemctl list-timers transit-tv-*
```

### View detailed timer information

```bash
sudo systemctl status transit-tv-start.timer
sudo systemctl status transit-tv-shutdown.timer
```

### Check service logs

```bash
# Main service logs
sudo journalctl -u transit-tv.service -n 50

# Shutdown action logs
sudo journalctl -u transit-tv-shutdown.service -n 20

# Start action logs
sudo journalctl -u transit-tv-start.service -n 20
```

### Test API endpoints manually

```bash
# Check server status
curl http://localhost:8080/api/server/status

# Trigger shutdown
curl -X POST http://localhost:8080/api/server/shutdown

# Trigger start
curl -X POST http://localhost:8080/api/server/start
```

### Common Issues

1. **Service fails to start**: Check that Node.js >= 24.0.0 is installed and .env file exists
2. **Permission denied**: Ensure transitv user has read access to all application files
3. **Port already in use**: Check if another service is using port 8080
4. **Timer not running**: Ensure both timer and service files are enabled
5. **API calls fail**: Verify main service is running and port is correct

## Customization

### Different User or Paths

Edit `transit-tv.service`:

```ini
User=your_user
Group=your_group
WorkingDirectory=/your/path
```

### Different Port

Edit `transit-tv-shutdown.service` and `transit-tv-start.service`:

```ini
ExecStart=/usr/bin/curl -f -X POST http://localhost:YOUR_PORT/api/server/shutdown
```

### Different Schedule

Edit timer files, using systemd calendar format:

```ini
# Examples:
OnCalendar=*-*-* 08:00:00          # Every day at 8 AM
OnCalendar=Mon,Wed,Fri 09:00:00    # Mon, Wed, Fri at 9 AM
OnCalendar=hourly                   # Every hour
```

See `man systemd.time` for more calendar format options.

## Migration from Docker Compose

If you were previously using docker compose with timers, you can:

1. Keep the same timer schedules (just update the service names)
2. Remove docker compose from the timers
3. Keep Transit TV data and configuration in place

The advantage of this approach is that the HTTP server stays running continuously, providing better reliability and management capabilities.

## References

- [systemd.service documentation](https://www.freedesktop.org/software/systemd/man/systemd.service.html)
- [systemd.timer documentation](https://www.freedesktop.org/software/systemd/man/systemd.timer.html)
- [Transit TV Repository](https://github.com/jasonad123/Transit-TV)
