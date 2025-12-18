'use strict';

var path = require('path');

// Note: Environment variables are loaded via --env-file flag (Node 24+)
// or injected by the deployment platform (Railway, Docker, etc.)

// Check for Transit API key in production
if (process.env.NODE_ENV === 'production' && !process.env.TRANSIT_API_KEY) {
	console.error('ERROR: TRANSIT_API_KEY is not set. The application will not function correctly.');
}

// Configuration validation helpers
// =================================

/**
 * Validates and returns a safe max distance value
 * @param {number} distance - The distance to validate
 * @returns {number} - Valid distance or default (500)
 */
function validateMaxDistance(distance) {
	var allowed = [250, 500, 750, 1000, 1250, 1500];
	if (allowed.includes(distance)) {
		return distance;
	}
	console.warn(
		'Invalid UNATTENDED_MAX_DISTANCE value: ' +
			distance +
			'. Must be one of: ' +
			allowed.join(', ') +
			'. Using default: 500'
	);
	return 500;
}

/**
 * Validates and returns a safe time format value
 * @param {string} format - The time format to validate
 * @returns {string} - Valid format or default (HH:mm)
 */
function validateTimeFormat(format) {
	var allowed = ['HH:mm', 'hh:mm A'];
	if (allowed.includes(format)) {
		return format;
	}
	console.warn(
		'Invalid UNATTENDED_TIME_FORMAT value: ' +
			format +
			'. Must be one of: ' +
			allowed.join(', ') +
			'. Using default: HH:mm'
	);
	return 'HH:mm';
}

/**
 * Validates and returns a safe theme value
 * @param {string} theme - The theme to validate
 * @returns {string} - Valid theme or default (auto)
 */
function validateTheme(theme) {
	var allowed = ['light', 'dark', 'auto'];
	if (allowed.includes(theme)) {
		return theme;
	}
	console.warn(
		'Invalid UNATTENDED_THEME value: ' +
			theme +
			'. Must be one of: ' +
			allowed.join(', ') +
			'. Using default: auto'
	);
	return 'auto';
}

/**
 * Validates and returns a safe columns value
 * @param {string} columns - The columns value to validate
 * @returns {string} - Valid columns or default (auto)
 */
function validateColumns(columns) {
	var allowed = ['auto', '1', '2', '3', '4', '5'];
	if (allowed.includes(columns)) {
		return columns;
	}
	console.warn(
		'Invalid UNATTENDED_COLUMNS value: ' +
			columns +
			'. Must be one of: ' +
			allowed.join(', ') +
			'. Using default: auto'
	);
	return 'auto';
}

/**
 * Validates location format (lat,lng)
 * @param {string} location - The location string to validate
 * @returns {string} - Original location or empty string if invalid
 */
function validateLocation(location) {
	if (!location) return '';

	var parts = location.split(',');
	if (parts.length !== 2) {
		console.warn(
			'Invalid UNATTENDED_LOCATION format: ' +
				location +
				'. Expected format: "latitude,longitude"'
		);
		return '';
	}

	var lat = parseFloat(parts[0]);
	var lng = parseFloat(parts[1]);

	if (isNaN(lat) || isNaN(lng)) {
		console.warn('Invalid UNATTENDED_LOCATION coordinates: ' + location);
		return '';
	}

	if (lat < -90 || lat > 90) {
		console.warn('Invalid latitude: ' + lat + '. Must be between -90 and 90');
		return '';
	}

	if (lng < -180 || lng > 180) {
		console.warn('Invalid longitude: ' + lng + '. Must be between -180 and 180');
		return '';
	}

	return location;
}

// All configurations will extend these options
// ============================================
var all = {
	// Root path of server
	root: path.normalize(__dirname + '/../../..'),

	// Server port
	port: process.env.PORT || 8080,

	// Server IP
	ip: process.env.IP || '0.0.0.0',

	// Secret for session, you will want to change this and make it an environment variable
	secrets: {
		session: process.env.SESSION_SECRET || 'transit-screen-secret'
	},

	// Transit API Key
	transitApiKey: process.env.TRANSIT_API_KEY || '',

	// API request timeout in milliseconds
	requestTimeout: parseInt(process.env.REQUEST_TIMEOUT) || 10000,

	// Unattended setup configuration
	unattendedSetup: {
		enabled: process.env.UNATTENDED_SETUP === 'true',
		location: validateLocation(process.env.UNATTENDED_LOCATION || ''),
		title: process.env.UNATTENDED_TITLE || '',
		timeFormat: validateTimeFormat(process.env.UNATTENDED_TIME_FORMAT || 'HH:mm'),
		theme: validateTheme(process.env.UNATTENDED_THEME || 'auto'),
		headerColor: process.env.UNATTENDED_HEADER_COLOR || '#30b566',
		columns: validateColumns(process.env.UNATTENDED_COLUMNS || 'auto'),
		showQRCode: process.env.UNATTENDED_SHOW_QR_CODE === 'true',
		maxDistance: validateMaxDistance(parseInt(process.env.UNATTENDED_MAX_DISTANCE) || 500),
		customLogo: process.env.UNATTENDED_CUSTOM_LOGO || null,
		groupItinerariesByStop: process.env.UNATTENDED_GROUP_ITINERARIES === 'true',
		filterRedundantTerminus: process.env.UNATTENDED_FILTER_TERMINUS === 'true'
	},

	// Security settings
	security: {
		// CORS settings (development only - disabled in production)
		cors: {
			allowedOrigins: process.env.ALLOWED_ORIGINS
				? process.env.ALLOWED_ORIGINS.split(',')
				: ['http://localhost:5173', 'http://localhost:8080']
		}
	}
};

module.exports = all;
