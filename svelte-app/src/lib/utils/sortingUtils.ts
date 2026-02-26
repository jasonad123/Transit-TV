export function isHighPriorityMode(modeName: string | undefined): boolean {
	if (!modeName) return false;
	const m = modeName.toLowerCase();
	return (
		m.includes('rail') ||
		m.includes('subway') ||
		m.includes('metro') ||
		m.includes('tram') ||
		m.includes('streetcar') ||
		m.includes('ferry') ||
		m.includes('rapid') // catches "Bus Rapid Transit"
	);
}

export function haversineDistance(
	lat1: number,
	lon1: number,
	lat2: number,
	lon2: number
): number {
	const R = 6371000;
	const φ1 = (lat1 * Math.PI) / 180;
	const φ2 = (lat2 * Math.PI) / 180;
	const Δφ = ((lat2 - lat1) * Math.PI) / 180;
	const Δλ = ((lon2 - lon1) * Math.PI) / 180;
	const a =
		Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// High-priority mode stops are elevated in sort order only when within this distance.
// Beyond this threshold, distance wins regardless of mode.
export const PRIORITY_MODE_ELEVATION_METERS = 400;

// Stops within this distance (meters) are merged into a single panel.
// Tight enough to avoid collapsing directional bus stops on wide streets (~35m road width),
// but enough to consolidate co-located bus bays at a terminal.
const PROXIMITY_MERGE_METERS = 50;

interface StopGroupLike {
	stopId: string;
	stopName: string;
	rows: Array<{ itinerary: { closest_stop?: { stop_lat?: number; stop_lon?: number } } }>;
}

/**
 * Merges stop groups whose first row's stop coords are within PROXIMITY_MERGE_METERS.
 * Handles co-located stops that lack a shared parent_station_global_stop_id.
 * The canonical stopId for each merged group is chosen to preserve stopOrder overrides.
 */
export function mergeProximateStopGroups<G extends StopGroupLike>(
	groups: Map<string, G>,
	stopOrder: string[]
): Map<string, G> {
	const list = Array.from(groups.values());
	const n = list.length;
	if (n < 2) return groups;

	// Union-find
	const par = list.map((_, i) => i);
	function find(i: number): number {
		while (par[i] !== i) {
			par[i] = par[par[i]];
			i = par[i];
		}
		return i;
	}

	for (let i = 0; i < n; i++) {
		for (let j = i + 1; j < n; j++) {
			if (list[i].stopName !== list[j].stopName) continue;
			const ci = list[i].rows[0]?.itinerary.closest_stop;
			const cj = list[j].rows[0]?.itinerary.closest_stop;
			if (ci?.stop_lat == null || ci.stop_lon == null) continue;
			if (cj?.stop_lat == null || cj.stop_lon == null) continue;
			if (
				haversineDistance(ci.stop_lat, ci.stop_lon, cj.stop_lat, cj.stop_lon) <=
				PROXIMITY_MERGE_METERS
			) {
				const ri = find(i),
					rj = find(j);
				if (ri !== rj) par[rj] = ri;
			}
		}
	}

	// Build components: root index → member indices
	const components = new Map<number, number[]>();
	for (let i = 0; i < n; i++) {
		const root = find(i);
		if (!components.has(root)) components.set(root, []);
		components.get(root)!.push(i);
	}

	const result = new Map<string, G>();
	for (const members of components.values()) {
		if (members.length === 1) {
			const g = list[members[0]];
			result.set(g.stopId, g);
			continue;
		}
		// Canonical stopId: prefer the member with the lowest stopOrder index
		const bestIdx = members.reduce((best, cur) => {
			const ob = stopOrder.indexOf(list[best].stopId);
			const oc = stopOrder.indexOf(list[cur].stopId);
			if (ob === -1 && oc === -1) return best < cur ? best : cur;
			if (ob === -1) return cur;
			if (oc === -1) return best;
			return ob <= oc ? best : cur;
		});
		const canonical = list[bestIdx];
		const allRows = members.flatMap((i) => list[i].rows) as G['rows'];
		result.set(canonical.stopId, { ...canonical, rows: allRows } as G);
	}

	return result;
}
