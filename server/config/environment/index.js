'use strict';

var path = require('path');
var _ = require('lodash');

function requiredProcessEnv(name) {
  if(!process.env[name]) {
    throw new Error('You must set the ' + name + ' environment variable');
  }
  return process.env[name];
}

// Check for Transit API key in production
if (process.env.NODE_ENV === 'production' && !process.env.TRANSIT_API_KEY) {
  console.warn('WARNING: TRANSIT_API_KEY is not set. The application may not function correctly.');
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
  transitApiKey: process.env.TRANSIT_API_KEY || ''
};

module.exports = all;
