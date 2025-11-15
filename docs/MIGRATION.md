# Migration Guide: AngularJS to SvelteKit

As of v1.0.0, Transit TV has been completely rewritten from AngularJS to SvelteKit for better performance, maintainability, and developer experience.

## For Users

### Upgrading from v0.5.2

All environment variables from v0.5.2 continue to work unchanged in v1.0.0. You can upgrade with confidence—no configuration changes required.

#### Docker Image Update

```bash
# Old
docker pull transit-tv:0.5.2

# New
docker pull ghcr.io/jasonad123/transit-tv:1.0.0

# Or use latest
docker pull ghcr.io/jasonad123/transit-tv:latest
```

#### Environment Variables (All Still Supported)

All v0.x environment variables work in v1.x without modification:

```bash
UNATTENDED_LOCATION=40.7240,-74.0002
UNATTENDED_TITLE="My Transit Station"
UNATTENDED_THEME=auto                    # light, dark, or auto
UNATTENDED_HEADER_COLOR=#30b566
UNATTENDED_COLUMNS=5                     # Now supports 1-5 (was 1-4)
UNATTENDED_SHOW_ROUTE_LONG_NAME=true
UNATTENDED_TIME_FORMAT=HH:mm
```

### Breaking Changes

**None.** Full backward compatibility maintained.

### New Features in v1.0.0

- **Responsive Grid Layout**: Now supports up to 5 columns (was 4 max)
- **Improved Dark Mode**: Better contrast and color handling
- **Enhanced Alerts**: More reliable scrolling and display for service alerts
- **Better Performance**: Smaller bundle size, faster load times
- **Modern Stack**: SvelteKit + Svelte 5 with TypeScript

## For Developers

### Development Setup

```bash
# Install dependencies
pnpm install

# Start Express server (API)
pnpm start

# In a separate terminal, start SvelteKit dev server
cd svelte-app
pnpm dev
```

### Production Build

```bash
# Build SvelteKit
cd svelte-app
pnpm build

# Return to root and run with Node
cd ..
NODE_ENV=production pnpm start
```

### Codebase Structure

**New in v1.0.0:**
- `svelte-app/` - SvelteKit frontend application
- `server/` - Express.js API and static file serving (shared with v0.x)

**Archived:**
- `legacy` branch - Complete AngularJS v0.5.2 source code (read-only reference)
- `archive/angularjs/*` - Old feature branches (for reference only)

### Building Docker Images

The project now builds with SvelteKit included:

```bash
docker build -t transit-tv:v1.0.0 .
docker run -e UNATTENDED_SETUP=true -e UNATTENDED_LOCATION="40.7,-74.0" -p 8080:8080 transit-tv:v1.0.0
```

### API & Integration Changes

**None.** The Express server API is identical to v0.5.2.

- Transit API integration unchanged
- Configuration endpoints unchanged
- Data format identical
- All route and service handling preserved

### Accessing Legacy Code

If you need to reference the original AngularJS implementation:

```bash
# Check out the legacy branch
git checkout legacy

# Or view specific files from legacy
git show legacy:client/app/app.js
```

## Troubleshooting

### Docker Image Not Found

Make sure you're using the new registry path: `ghcr.io/jasonad123/transit-tv`

The old Docker Hub images are no longer updated. If you have old images, pull the latest from GHCR.

### Configuration Not Loading

All environment variables are still supported. If something isn't working:

1. Verify your UNATTENDED_LOCATION is in format: `latitude,longitude`
2. Check that UNATTENDED_SETUP=true is set
3. Ensure NODE_ENV=production for production deployments

### Display Issues

- Check browser console for errors (F12 / Dev Tools)
- Clear browser cache
- Try with UNATTENDED_THEME=light to rule out dark mode issues

## Version History

- **v1.0.0** (Current) - SvelteKit rewrite, full backward compatibility
- **v0.5.2** (Legacy) - Final AngularJS version, available in `legacy` branch

## Questions?

For issues or questions about migration:
- Check the `legacy` branch if you need to reference AngularJS implementation
- Review environment variables in `.env.example`
- Check recent commits for implementation details
