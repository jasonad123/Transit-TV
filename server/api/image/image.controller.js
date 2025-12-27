'use strict';

// Get one image
exports.show = async function (req, res) {
	// Validate input parameters
	if (!req.params.id) {
		return res.status(400).json({ error: 'Image ID is required' });
	}

	var imageName = req.params.id,
		primaryColor = req.query.primaryColor || '010101',
		secondaryColor = req.query.secondaryColor || 'EFEFEF';

	// Validate imageName to prevent SSRF and path traversal
	// Only allow alphanumeric, underscore, hyphen, must start with a letter/number, no path traversal, max length 68.
	var imageNameRegex = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}(\.svg)?$/;
	if (!imageNameRegex.test(imageName)) {
		return res.status(400).json({
			error:
				'Invalid image name. Image name must only contain letters, numbers, underscores, hyphens, optionally end with .svg, and be up to 68 characters.'
		});
	}

	// Validate color format (should be a valid hex color without the # prefix)
	var hexColorRegex = /^[0-9A-Fa-f]{6}$/;
	if (!hexColorRegex.test(primaryColor) || !hexColorRegex.test(secondaryColor)) {
		return res.status(400).json({
			error: 'Invalid color format. Colors must be 6-character hex values without the # prefix'
		});
	}

	var suffix = primaryColor === '000000' ? '-mono' : '-color-light',
		filename = imageName.replace('.svg', '') + suffix + '.svg',
		url = 'https://transitapp-data.com/images/svgx/' + filename;

	try {
		const response = await fetch(url, {
			signal: AbortSignal.timeout(10000) // 10 second timeout
		});

		if (!response.ok) {
			req.log.error(
				{
					api: 'image',
					status: response.status,
					url: url,
					imageName: imageName
				},
				'Error response from image API'
			);
			return handleError(req, res, 'Image not found or unavailable', response.status);
		}

		let data = await response.text();

		if (!data) {
			return handleError(req, res, 'Empty response from image server');
		}

		try {
			data = data
				.replace(new RegExp(`#010101`, 'gi'), `#${primaryColor}`)
				.replace(new RegExp(`#EFEFEF`, 'gi'), `#${secondaryColor}`);
		} catch (err) {
			req.log.error({ err: err, imageName: imageName }, 'Error processing image data');
			return handleError(req, res, 'Failed to process image data');
		}

		// Set content type for SVG
		res
			.status(200)
			.set('Content-Type', 'image/svg+xml')
			.set('Cache-Control', 'public, max-age=86400')
			.send(data);
	} catch (err) {
		req.log.error({ err: err, url: url, imageName: imageName }, 'Error fetching image');
		return handleError(req, res, 'Failed to fetch image');
	}
};

function handleError(req, res, err, statusCode) {
	req.log.error({ error: err, statusCode: statusCode || 500 }, 'Image API error');
	return res.status(statusCode || 500).json({ error: err });
}
