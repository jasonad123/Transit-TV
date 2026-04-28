# Archived: feature/crowding-info

**Status:** Parked — superseded and blocked

## Why this branch is parked

This branch adds occupancy/crowding indicators to transit departure cards using
the `occupancy_status` field from the Transit API's `/v4/public/vehicles` endpoint.

**API verification failed (2026-04-28):** The `occupancy_status` field was confirmed
to not be returned by the Transit API for any tested agency. The feature cannot be
shipped without real data.

## Why this specific branch is redundant

`feature/micromobility` is a strict superset of this branch — it contains these
same crowding commits plus the additional placemarks/micromobility display work.
If and when the API supports crowding data, `feature/micromobility` is the branch
to resume from, not this one.

## Resuming this work

Before reviving:
1. Verify `/v4/public/vehicles?global_route_id=X` returns `occupancy_status` in a
   live deployment for at least one agency
2. Remove or gate `VITE_MOCK_CROWDING` — do not ship mock data in production builds
3. Rebase `feature/micromobility` (not this branch) onto the then-current `main`
