'use strict';

var path = require('path');

// Note: Environment variables are loaded via --env-file flag (Node 24+)
// or injected by the deployment platform (Railway, Docker, etc.)

// Check for Transit API key in production
if (process.env.NODE_ENV === 'production' && !process.env.TRANSIT_API_KEY) {
  console.error('ERROR: TRANSIT_API_KEY is not set. The application will not function correctly.');
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
    location: process.env.UNATTENDED_LOCATION || '',
    title: process.env.UNATTENDED_TITLE || '',
    timeFormat: process.env.UNATTENDED_TIME_FORMAT || 'HH:mm',
    theme: process.env.UNATTENDED_THEME || 'light',
    headerColor: process.env.UNATTENDED_HEADER_COLOR || '#30b566',
    columns: process.env.UNATTENDED_COLUMNS || 'auto',
    showQRCode: process.env.UNATTENDED_SHOW_QR_CODE === 'true',
    maxDistance: parseInt(process.env.UNATTENDED_MAX_DISTANCE) || 500
  },
  
  // Security settings
  security: {
    // CORS settings (development only - disabled in production)
    cors: {
      allowedOrigins: process.env.ALLOWED_ORIGINS ?
        process.env.ALLOWED_ORIGINS.split(',') :
        ['http://localhost:5173', 'http://localhost:8080']
    }
  }
};

module.exports = all;
