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
