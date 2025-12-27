'use strict';

var config = require('../../config/environment');

// Validate coordinate format (lat,lng)
function validateCoordinates(locationStr) {
	if (!locationStr || typeof locationStr !== 'string') {
		return false;
	}

	var coords = locationStr.split(',');
	if (coords.length !== 2) {
		return false;
	}

	var lat = parseFloat(coords[0].trim());
	var lng = parseFloat(coords[1].trim());

	// Check if valid numbers and within valid ranges
	if (isNaN(lat) || isNaN(lng)) {
		return false;
	}

	if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
		return false;
	}

	return { latitude: lat, longitude: lng };
}

// Validate time format
function validateTimeFormat(format) {
	var validFormats = ['HH:mm', 'hh:mm A', 'hh:mm']; // Added 'hh:mm' for 12-hour without AM/PM
	return validFormats.includes(format);
}

// Validate language code
function validateLanguage(lang) {
	var validLanguages = ['en', 'fr', 'es', 'de'];
	return validLanguages.includes(lang);
}

// Get unattended setup configuration
exports.getUnattendedConfig = function (req, res) {
	if (!config.unattendedSetup.enabled) {
		return res.status(404).json({
			error: 'Unattended setup is not enabled'
		});
	}

	// Validate coordinates
	var coordinates = validateCoordinates(config.unattendedSetup.location);
	if (!coordinates) {
		return res.status(400).json({
			error: 'Invalid coordinates format. Expected: "latitude,longitude"'
		});
	}

	// Validate time format
	if (!validateTimeFormat(config.unattendedSetup.timeFormat)) {
		return res.status(400).json({
			error: 'Invalid time format. Expected: "HH:mm", "hh:mm A", or "hh:mm"'
		});
	}

	// Validate language
	if (!validateLanguage(config.unattendedSetup.language)) {
		return res.status(400).json({
			error: 'Invalid language. Expected: "en", "fr", "es", or "de"'
		});
	}

	res.json({
		enabled: true,
		latLng: coordinates,
		title: config.unattendedSetup.title,
		timeFormat: config.unattendedSetup.timeFormat,
		language: config.unattendedSetup.language,
		theme: config.unattendedSetup.theme,
		headerColor: config.unattendedSetup.headerColor,
		columns: config.unattendedSetup.columns,
		showQRCode: config.unattendedSetup.showQRCode,
		maxDistance: config.unattendedSetup.maxDistance || 500,
		customLogo: config.unattendedSetup.customLogo,
		groupItinerariesByStop: config.unattendedSetup.groupItinerariesByStop,
		filterRedundantTerminus: config.unattendedSetup.filterRedundantTerminus,
		showRouteLongName: config.unattendedSetup.showRouteLongName
	});
};
