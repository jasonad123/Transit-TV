'use strict';

var path = require('path');
var _ = require('lodash');
var fs = require('fs');

function requiredProcessEnv(name) {
  if(!process.env[name]) {
    throw new Error('You must set the ' + name + ' environment variable');
  }
  return process.env[name];
}

// Load environment variables from .env file if present
try {
  if (fs.existsSync(path.join(__dirname, '../../../.env'))) {
    console.log('Loading environment variables from .env file');
    require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
  }
} catch (err) {
  console.error('Error loading .env file:', err);
}

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
    timeFormat: process.env.UNATTENDED_TIME_FORMAT || 'HH:mm'
  },
  
  // Security settings
  security: {
    // CORS settings
    cors: {
      allowedOrigins: process.env.ALLOWED_ORIGINS ? 
        process.env.ALLOWED_ORIGINS.split(',') : 
        ['http://localhost:8080']
    }
  }
};

module.exports = all;
