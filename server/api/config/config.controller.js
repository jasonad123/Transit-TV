'use strict';

var config = require('../../config/environment');
var logger = require('../../config/logger');

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

	// Use default coordinates if not provided (New York City)
	var coordinates = validateCoordinates(config.unattendedSetup.location);
	if (!coordinates) {
		// Log warning about falling back to default coordinates
		if (config.unattendedSetup.location) {
			logger.warn({
				providedLocation: config.unattendedSetup.location,
				defaultLatitude: 40.75426683398718,
				defaultLongitude: -73.98672703719805
			}, 'Invalid UNATTENDED_LOCATION format. Falling back to default coordinates (New York City).');
		} else {
			logger.warn({
				defaultLatitude: 40.75426683398718,
				defaultLongitude: -73.98672703719805
			}, 'UNATTENDED_LOCATION not provided. Using default coordinates (New York City).');
		}
		coordinates = { latitude: 40.75426683398718, longitude: -73.98672703719805 };
	}

	// Use default time format if not provided
	var timeFormat = config.unattendedSetup.timeFormat;
	if (!validateTimeFormat(timeFormat)) {
		// Log warning about falling back to default time format
		if (config.unattendedSetup.timeFormat) {
			logger.warn({
				providedTimeFormat: config.unattendedSetup.timeFormat,
				defaultTimeFormat: 'HH:mm'
			}, 'Invalid UNATTENDED_TIME_FORMAT. Falling back to default format (HH:mm).');
		} else {
			logger.warn({
				defaultTimeFormat: 'HH:mm'
			}, 'UNATTENDED_TIME_FORMAT not provided. Using default format (HH:mm).');
		}
		timeFormat = 'HH:mm';
	}

	// Use default language if not provided
	var language = config.unattendedSetup.language;
	if (!validateLanguage(language)) {
		// Log warning about falling back to default language
		if (config.unattendedSetup.language) {
			logger.warn({
				providedLanguage: config.unattendedSetup.language,
				defaultLanguage: 'en'
			}, 'Invalid UNATTENDED_LANGUAGE. Falling back to default language (en).');
		} else {
			logger.warn({
				defaultLanguage: 'en'
			}, 'UNATTENDED_LANGUAGE not provided. Using default language (en).');
		}
		language = 'en';
	}

	res.json({
		enabled: true,
		latLng: coordinates,
		title: config.unattendedSetup.title,
		timeFormat: timeFormat,
		language: language,
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
