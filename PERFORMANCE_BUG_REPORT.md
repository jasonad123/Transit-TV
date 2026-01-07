# CRITICAL: Performance Bug Causing UI Unresponsiveness

**Status:** 🔴 **CRITICAL - Causes browser freeze/unresponsiveness**
**Branch:** feature/table-view-v4
**Affected Components:** ListView.svelte, CompactView.svelte
**Root Cause:** O(n²) alert filtering with redundant computations in render path

---

## The Problem

The UI becomes unresponsive in local development because **expensive computations are being repeated hundreds or thousands of times per render**.

### Performance Complexity

For a typical display with:

- **20 routes** visible on screen
- **5 alerts** per route
- **10 itineraries** per route

The current code performs approximately **7,000+ iterations PER RENDER**!

---

## Root Cause Analysis

### Issue 1: `getLocalStopIds()` Creates New Set Every Call

**Location:** `ListView.svelte:82-91`, `CompactView.svelte:425-433`

```javascript
function getLocalStopIds(): Set<string> {
    const stopIds = new Set<string>();
    route.itineraries?.forEach((itinerary) => {
        if (itinerary.closest_stop?.global_stop_id) {
            stopIds.add(itinerary.closest_stop.global_stop_id);
        }
    });
    return stopIds;  // ❌ Creates NEW Set every single call!
}
```

**Problem:** This function is called inside `isAlertRelevantToRoute()`, which is called for EVERY alert during filtering.

**Impact:** If a route has 10 itineraries and 5 alerts:

- Creates 5 new Sets
- Iterates through 10 itineraries × 5 times = 50 iterations
- **Per route, per render!**

---

### Issue 2: `getRelevantAlerts()` Called Multiple Times

**In ListView.svelte:**

```javascript
// Called in:
function hasRelevantAlerts(): boolean {
    return getRelevantAlerts().length > 0;  // Call #1
}

function getAlertText(): string {
    const relevantAlerts = getRelevantAlerts();  // Call #2
    // ...
}

let relevantAlertCount = $derived(getRelevantAlerts().length);  // Call #3

function getMostSevereAlertLevel(): 'severe' | 'warning' | 'info' {
    const alerts = getRelevantAlerts();  // Call #4
    // ...
}
```

**Result:** Same expensive filtering operation runs 4+ times per component!

---

### Issue 3: `getMostSevereAlertLevel()` Called 4 Times in Template

**Location:** `ListView.svelte:230-233`

```svelte
<div
    class:severe={getMostSevereAlertLevel() === 'severe'}    <!-- Call #1 -->
    class:warning={getMostSevereAlertLevel() === 'warning'}  <!-- Call #2 -->
    class:info={getMostSevereAlertLevel() === 'info'}        <!-- Call #3 -->
>
    <iconify-icon icon={getMostSevereAlertIcon()}></iconify-icon>  <!-- Calls getMostSevereAlertLevel() again! -->
```

Each call triggers the entire chain:

1. `getMostSevereAlertLevel()`
2. → calls `getRelevantAlerts()`
3. → calls `route.alerts.filter(isAlertRelevantToRoute)`
4. → for each alert, calls `getLocalStopIds()`
5. → creates new Set and iterates all itineraries

**This happens 4 times just for styling!**

---

### Issue 4: CompactView Has Partial Fix But Still Broken

CompactView caches with `$derived`:

```javascript
let relevantAlerts = $derived(getRelevantAlerts());  // ✅ Good!

// But then:
function getMostSevereAlertLevel(): 'severe' | 'warning' | 'info' {
    const alerts = getRelevantAlerts();  // ❌ Calls it again instead of using relevantAlerts!
    // ...
}
```

So it still has redundant calls.

---

## Measured Impact

### Before Fix (Current State)

For **20 visible routes**, each with 5 alerts and 10 itineraries:

```
Per component per render:
- getRelevantAlerts() calls: 7
- getLocalStopIds() calls: 7 × 5 alerts = 35
- Set creations: 35
- Itinerary iterations: 35 × 10 = 350

Total for 20 routes:
- getRelevantAlerts() calls: 140
- getLocalStopIds() calls: 700
- Set creations: 700
- Itinerary iterations: 7,000
```

**Every single render!**

If Svelte re-renders on scroll, data updates, or theme changes → **instant browser freeze**.

---

## The Fix

### Step 1: Cache Stop IDs (Memoization)

**Before:**

```javascript
function getLocalStopIds(): Set<string> {
    const stopIds = new Set<string>();
    route.itineraries?.forEach((itinerary) => {
        if (itinerary.closest_stop?.global_stop_id) {
            stopIds.add(itinerary.closest_stop.global_stop_id);
        }
    });
    return stopIds;
}
```

**After:**

```javascript
// Cache using $derived - only recomputes when route.itineraries changes
let localStopIds = $derived.by(() => {
    const stopIds = new Set<string>();
    route.itineraries?.forEach((itinerary) => {
        if (itinerary.closest_stop?.global_stop_id) {
            stopIds.add(itinerary.closest_stop.global_stop_id);
        }
    });
    return stopIds;
});

function isAlertRelevantToRoute(alert: any): boolean {
    if (!alert.informed_entities || alert.informed_entities.length === 0) {
        return true;
    }

    // Use cached value instead of calling function
    return alert.informed_entities.some((entity: any) => {
        const hasRouteId = !!entity.global_route_id;
        const hasStopId = !!entity.global_stop_id;

        if (!hasRouteId && !hasStopId) {
            return true;
        }

        const routeMatches = !hasRouteId || entity.global_route_id === route.global_route_id;
        const stopMatches = !hasStopId || localStopIds.has(entity.global_stop_id);  // ✅ Use cached Set

        return routeMatches && stopMatches;
    });
}
```

---

### Step 2: Cache Relevant Alerts

**Before (ListView):**

```javascript
function getRelevantAlerts() {
	if (!route.alerts?.length) return [];
	return route.alerts.filter(isAlertRelevantToRoute);
}

let relevantAlertCount = $derived(getRelevantAlerts().length); // Redundant call
```

**After:**

```javascript
let relevantAlerts = $derived.by(() => {
	if (!route.alerts?.length) return [];
	return route.alerts.filter(isAlertRelevantToRoute);
});

let relevantAlertCount = $derived(relevantAlerts.length); // ✅ Use cached value
```

---

### Step 3: Cache Alert Level and Use Cached Values

**Before:**

```javascript
function getMostSevereAlertLevel(): 'severe' | 'warning' | 'info' {
    const alerts = getRelevantAlerts();  // ❌ Redundant call
    if (!alerts.length) return 'info';
    // ...
}

// In template:
class:severe={getMostSevereAlertLevel() === 'severe'}    // Call #1
class:warning={getMostSevereAlertLevel() === 'warning'}  // Call #2
class:info={getMostSevereAlertLevel() === 'info'}        // Call #3
```

**After:**

```javascript
let mostSevereLevel = $derived.by(() => {
    if (!relevantAlerts.length) return 'info';  // ✅ Use cached relevantAlerts

    if (relevantAlerts.some((a) => (a.severity || 'Info').toLowerCase() === 'severe')) {
        return 'severe';
    }
    if (relevantAlerts.some((a) => (a.severity || 'Info').toLowerCase() === 'warning')) {
        return 'warning';
    }
    return 'info';
});

let mostSevereIcon = $derived.by(() => {
    if (mostSevereLevel === 'severe') return 'ix:warning-octagon-filled';
    if (mostSevereLevel === 'warning') return 'ix:warning-filled';
    return 'ix:about-filled';
});

// In template:
class:severe={mostSevereLevel === 'severe'}    // ✅ Single cached value
class:warning={mostSevereLevel === 'warning'}  // ✅ Single cached value
class:info={mostSevereLevel === 'info'}        // ✅ Single cached value
```

---

### Step 4: Update Template References

**Before:**

```svelte
{#if hasRelevantAlerts()}
	<!-- Function call -->
	<iconify-icon icon={getMostSevereAlertIcon()}></iconify-icon>
	<!-- Function call -->
	{#each parseAlertContent(getAlertText()) as content}
		<!-- Function call -->
		<!-- ... -->
	{/each}
{/if}
```

**After:**

```svelte
{#if relevantAlerts.length > 0}
	<!-- ✅ Cached value -->
	<iconify-icon icon={mostSevereIcon}></iconify-icon>
	<!-- ✅ Cached value -->
	{#each parseAlertContent(alertText) as content}
		<!-- ✅ Cached value -->
		<!-- ... -->
	{/each}
{/if}
```

---

## Expected Performance Improvement

### After Fix

For **20 visible routes**, each with 5 alerts and 10 itineraries:

```
Per component per render:
- localStopIds calculation: 1 (only when itineraries change)
- relevantAlerts filtering: 1 (only when alerts or stopIds change)
- Alert level calculation: 1 (only when relevantAlerts changes)
- Itinerary iterations: 10 (only once)

Total for 20 routes:
- Set creations: 20 (vs 700) - 97% reduction
- Filter operations: 20 (vs 140) - 86% reduction
- Total iterations: 200 (vs 7,000) - 97% reduction
```

**Expected result:** Smooth, responsive UI even with 30+ routes visible.

---

## Why This Only Affects feature/table-view-v4

The performance bug **exists in the original RouteItem.svelte too**, but it's not noticeable because:

1. **Card view shows fewer routes** - Typically 4-8 routes fit on screen
2. **Compact/List views are denser** - Can show 20-30 routes at once
3. **Multiplication effect** - 3× more routes = 3³ = 27× more computations due to O(n²) complexity

So when you switch from Card view (8 routes) to List view (24 routes):

- Old computation: 8 routes × 350 iterations = 2,800 iterations
- New computation: 24 routes × 350 iterations = 8,400 iterations
- **3× more routes = 3× worse freeze!**

---

## Files to Fix

### High Priority (Causes Freeze)

1. ✅ `svelte-app/src/lib/components/ListView.svelte`
2. ✅ `svelte-app/src/lib/components/CompactView.svelte`

### Medium Priority (Same Issue, Less Impact)

3. `svelte-app/src/lib/components/RouteItem.svelte` - Should also be fixed for consistency

---

## Testing Instructions

### Before Fix

1. Switch to `feature/table-view-v4` branch
2. Set view mode to "List" or "Compact"
3. Load 20+ routes
4. Open browser DevTools → Performance tab
5. Record profile while scrolling
6. **Observe:** Long tasks, dropped frames, unresponsive UI

### After Fix

1. Apply the fixes above
2. Repeat steps 2-5
3. **Expected:** Smooth scrolling, no dropped frames, responsive UI

---

## Related Issues

This performance issue is **independent** of the other stability issues found:

- SvelteMap revert (reactivity issue)
- ListView separator bug (visual issue)
- Theme asset loading (path issue)

However, it's the **most severe** because it makes the app completely unusable.

---

## Priority

🔴 **CRITICAL** - Must be fixed before merging to main

The other issues can be monitored or fixed post-merge, but this performance bug makes the new view modes completely unusable in production.
