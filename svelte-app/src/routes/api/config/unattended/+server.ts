import type { RequestHandler } from './$types';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

export const GET: RequestHandler = async () => {
	try {
		const response = await fetch(`${BACKEND_URL}/api/config/unattended`);

		if (!response.ok) {
			return new Response(JSON.stringify({ error: 'Unattended config not available' }), {
				status: response.status,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const data = await response.json();
		return new Response(JSON.stringify(data), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		console.error('Error proxying to backend:', error);
		return new Response(JSON.stringify({ error: 'Backend unavailable' }), {
			status: 503,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
