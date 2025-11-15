import type { RequestHandler } from './$types';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

export const GET: RequestHandler = async ({ params, url }) => {
	const imagePath = params.path;
	const queryString = url.searchParams.toString();
	const backendUrl = `${BACKEND_URL}/api/images/${imagePath}${queryString ? `?${queryString}` : ''}`;

	try {
		const response = await fetch(backendUrl);

		if (!response.ok) {
			return new Response('Image not found', { status: 404 });
		}

		const contentType = response.headers.get('content-type') || 'image/svg+xml';
		const imageData = await response.arrayBuffer();

		return new Response(imageData, {
			headers: { 'Content-Type': contentType }
		});
	} catch (error) {
		console.error('Error proxying image:', error);
		return new Response('Backend unavailable', { status: 503 });
	}
};
