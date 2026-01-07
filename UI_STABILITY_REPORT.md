# UI Stability Analysis: feature/table-view-v4 Branch

**Analysis Date:** 2026-01-06
**Branch Analyzed:** feature/table-view-v4 (commit 3af5d2d)
**Comparison Base:** claude/check-table-view-stability-Ej1rJ

---

## Executive Summary

The `feature/table-view-v4` branch introduces significant UI changes including new view modes (Compact and List views), extensive CSS refactoring, and component restructuring. While most changes are well-structured, there are **several potential stability issues** that could particularly affect local deployments.

---

## Critical Issues Found

### 1. **SvelteMap/SvelteSet Revert (commit cb017e4)**

**Issue:** The branch attempted to use Svelte 5's reactive `SvelteMap` and `SvelteSet` but had to revert back to standard JavaScript `Map` and `Set`.

**Files Affected:**

- `svelte-app/src/lib/components/CompactView.svelte:390`
- `svelte-app/src/lib/components/CompactView.svelte:425`
- `svelte-app/src/lib/components/ListView.svelte:49`
- `svelte-app/src/lib/components/ListView.svelte:84`

**Impact:** This suggests compatibility issues with Svelte 5's reactive collections. The revert means that changes to these Maps/Sets won't automatically trigger reactivity, which could lead to:

- Stale data display when itineraries are grouped by stop
- UI not updating when alerts change
- Missed re-renders when route data updates

**Recommendation:** Monitor itinerary grouping and alert updates closely in production. Consider implementing explicit reactivity triggers or upgrading to proper Svelte 5 reactive patterns.

---

### 2. **Critical ListView Separator Bug (commit 3af5d2d)**

**Issue:** A last-minute "critical" fix modified separator logic in ListView.

**Change:**

```javascript
// Before: Checked against full filtered array length
{#if itemIndex < (itinerary.schedule_items?.filter(shouldShowDeparture).length || 0) - 1}

// After: Only checks against first 3 items
{#if itemIndex < (itinerary.schedule_items?.filter(shouldShowDeparture).slice(0, 3).length || 0) - 1}
```

**Location:** `svelte-app/src/lib/components/ListView.svelte:209`

**Impact:** This fix suggests that:

- Original separator logic was causing crashes or visual bugs
- The display logic was not properly synchronized with the actual rendering
- There may be additional edge cases not yet discovered

**Recommendation:** Review the full departure item rendering logic. This looks like a symptom of a larger issue with array indexing/filtering consistency.

---

### 3. **Theme-Based Asset Loading (commit fdccce9)**

**Issue:** Real-time wave indicators now load different images based on theme, using CSS attribute selectors.

**Changes:**

```css
/* In app.css - global theme-based rules */
[data-theme='dark'] .time-item::before {
	background-image: url('/assets/images/real_time_wave_small-w@2x.png') !important;
}

[data-theme='light'] .time-item::before {
	background-image: url('/assets/images/real_time_wave_small@2x.png') !important;
}
```

**Local Deployment Concerns:**

- **Missing assets:** These wave image files must exist in `/assets/images/` or display will break
- **Path resolution:** Local deployments might have different base paths
- **!important overrides:** Makes debugging difficult and could conflict with component styles
- **No fallbacks:** If images don't load, no graceful degradation

**Recommendation:**

- Verify all wave image assets exist in repository
- Add fallback styles if images fail to load
- Consider using SVG waves instead of PNG for better scaling and smaller bundle size

---

### 4. **Dynamic Alert Height Calculations**

**Issue:** Alert container heights use complex viewport-based calculations with multiple breakpoints.

**Code:**

```css
.route-alert-container {
	height: clamp(5em, 15vh, 18em);
}

.route-alert-container.grouped-alerts {
	height: clamp(5em, 19.5vh, 22em);
}

@media (orientation: portrait) {
	.route-alert-container.grouped-alerts {
		height: clamp(5em, 10vh, 15em);
	}
}
```

**Local Deployment Concerns:**

- Different screen sizes/resolutions could cause:
  - Content overflow
  - Alerts being cut off
  - Inconsistent spacing
- Portrait vs landscape switching could cause layout jumps
- The `clamp()` values are duplicated in both `app.css` and component styles

**Recommendation:** Test on multiple screen sizes, especially:

- Small screens (1024x768)
- Ultra-wide displays (3440x1440)
- Portrait orientation tablets
- 4K displays with different scaling

---

### 5. **Missing Local Environment Sample (deleted file)**

**Issue:** The `server/config/local.env.sample.js` file was deleted.

**Impact on Local Deployments:**

- No reference for required environment variables
- Developers setting up locally won't know what to configure
- Could lead to misconfigured local instances

**Recommendation:** Restore this file or add equivalent documentation in README for local setup requirements, especially for the new `VIEW_MODE` environment variable.

---

### 6. **New VIEW_MODE Configuration**

**Issue:** A new `VIEW_MODE` environment variable was added but not well documented.

**Valid Values:** `'card'`, `'compact'`, `'list'`

**Location:** `server/config/environment/index.js:213-223`

**Local Deployment Concerns:**

- If `VIEW_MODE` is set to invalid value, falls back to 'card' silently
- No documentation about which view mode is best for which screen sizes
- Switching view modes dynamically could expose bugs in each view

**Recommendation:**

- Document recommended view modes for different deployment scenarios
- Add validation warnings to logs when invalid values are used
- Test all three view modes thoroughly

---

## Potential Stability Issues by Component

### ListView Component

**Concerns:**

- Separator index calculation bug (recently fixed but may have edge cases)
- Loss of reactivity from SvelteMap revert
- Theme-based wave icons might not load properly
- Complex time item filtering logic

**Files:** `svelte-app/src/lib/components/ListView.svelte`

### CompactView Component

**Concerns:**

- Loss of reactivity from SvelteMap revert for itinerary grouping
- Alert relevance filtering might not update properly
- Responsive layout calculations could fail on edge-case screen sizes

**Files:** `svelte-app/src/lib/components/CompactView.svelte`

### Global CSS (app.css)

**Concerns:**

- Heavy use of `!important` flags makes debugging difficult
- Theme-dependent asset URLs could fail if paths are wrong
- Duplicated alert height styles between global CSS and components
- Complex viewport-based sizing could cause overflow issues

**Files:** `svelte-app/src/app.css`

---

## Testing Recommendations for Local Deployments

### 1. Asset Loading Tests

```bash
# Verify all required assets exist
ls -la svelte-app/static/assets/images/real_time_wave*
```

Expected files:

- `real_time_wave_small@2x.png`
- `real_time_wave_small-w@2x.png` (white version)
- `real_time_wave_big@2x.png`
- `real_time_wave_big-w@2x.png` (white version)

### 2. View Mode Testing

Test each view mode thoroughly:

```javascript
// In browser console or via environment variable
// Test: VIEW_MODE=card
// Test: VIEW_MODE=compact
// Test: VIEW_MODE=list
```

### 3. Theme Switching

- Switch between light and dark themes multiple times
- Verify wave icons change correctly
- Check for console errors about missing assets
- Verify alert styling updates properly

### 4. Screen Size Testing

Test on these viewport sizes:

- 1024x768 (small landscape)
- 1920x1080 (standard desktop)
- 2560x1440 (QHD)
- 3840x2160 (4K)
- 768x1024 (tablet portrait)

### 5. Itinerary Grouping

- Enable `groupItinerariesByStop` setting
- Verify routes group correctly
- Check that updates to routes trigger re-grouping
- Monitor for stale data (due to Map/Set reactivity issue)

### 6. Alert Updates

- Monitor routes with active alerts
- Verify alerts update when new data arrives
- Check that alert filtering by stop works correctly
- Test grouped vs ungrouped alert display

---

## Configuration Issues

### Missing Documentation

1. No documentation for new `VIEW_MODE` variable
2. Deleted `local.env.sample.js` removes setup reference
3. No guidance on which view mode works best for specific use cases

### Environment Variables to Document

```bash
# Add to documentation:
VIEW_MODE=card|compact|list  # Default: card
UNATTENDED_GROUP_ITINERARIES=true|false
UNATTENDED_FILTER_TERMINUS=true|false
UNATTENDED_SHOW_ROUTE_NAMES=true|false
```

---

## Risk Assessment

| Issue                       | Severity | Likelihood | Impact on Local Deploy             |
| --------------------------- | -------- | ---------- | ---------------------------------- |
| SvelteMap revert reactivity | High     | Medium     | Data staleness, missed updates     |
| ListView separator bug      | Medium   | Low        | Visual glitches, potential crashes |
| Missing wave assets         | High     | High       | Broken real-time indicators        |
| Alert height overflow       | Medium   | Medium     | Cut-off content on some screens    |
| Missing env sample          | Low      | High       | Setup confusion for new devs       |
| Invalid VIEW_MODE           | Low      | Low        | Silent fallback to card view       |

---

## Recommended Actions

### Immediate (Before Merge)

1. ✅ Verify all wave image assets exist in repository
2. ✅ Restore `local.env.sample.js` with VIEW_MODE documentation
3. ✅ Test all three view modes on multiple screen sizes
4. ✅ Add fallback styles for missing wave images
5. ✅ Review ListView separator logic for additional edge cases

### Short-term (After Merge)

1. Monitor for reactivity issues with Maps/Sets in grouped views
2. Consider migrating to Svelte 5 reactive collections properly
3. Consolidate duplicate alert height CSS rules
4. Add error logging when assets fail to load
5. Document recommended view modes for different scenarios

### Long-term

1. Replace PNG wave icons with SVG for better scaling
2. Refactor alert height calculations to be more robust
3. Add comprehensive E2E tests for view switching
4. Implement proper reactivity patterns for Svelte 5

---

## Conclusion

The `feature/table-view-v4` branch introduces valuable new features but has several stability concerns, particularly:

1. **Reactivity issues** from reverting Svelte 5 reactive collections
2. **Asset loading dependencies** that could fail in different deployment environments
3. **Recent critical bug fixes** that suggest underlying issues may remain
4. **Complex CSS calculations** that could break on edge-case screen sizes

**For local deployments specifically**, the main risks are:

- Missing wave image assets
- Misconfigured environment variables (no sample file)
- Screen size compatibility issues
- Theme switching problems

**Recommendation:** This branch needs thorough testing on actual local deployment hardware before production use, with special attention to asset loading and screen size compatibility.
