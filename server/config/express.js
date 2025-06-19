/**
 * Express configuration
 */

'use strict';

var express = require('express');
var favicon = require('serve-favicon');
var morgan = require('morgan');
var compression = require('compression');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var cookieParser = require('cookie-parser');
var errorHandler = require('errorhandler');
var path = require('path');
var config = require('./environment');
var helmet = require('helmet');

module.exports = function(app) {
  var env = app.get('env');

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: false // We'll configure this manually if needed
  }));
  
  // Set up CORS
  app.use(function(req, res, next) {
    var allowedOrigins = config.security.cors.allowedOrigins;
    var origin = req.headers.origin;
    
    if (allowedOrigins.indexOf(origin) > -1) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', true);
    
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    
    next();
  });

  app.set('views', config.root + '/server/views');
  app.engine('html', require('ejs').renderFile);
  app.set('view engine', 'html');
  app.use(compression());
  app.use(bodyParser.urlencoded({ extended: false, limit: '1mb' }));
  app.use(bodyParser.json({ limit: '1mb' }));
  app.use(methodOverride());
  app.use(cookieParser());

  if ('development' === env) {
    app.use(require('connect-livereload')());
    app.use(express.static(path.join(config.root, '.tmp')));
    app.use(express.static(path.join(config.root, 'client')));
    app.use('/node_modules', express.static(path.join(config.root, 'node_modules')));
    app.set('appPath', path.join(config.root, 'client'));
    app.use(morgan('dev'));
    app.use(errorHandler()); // Error handler - has to be last
  } else {
    try {
      app.use(favicon(path.join(config.root, 'client', 'favicon.ico')));
    } catch(e) {
      console.warn('Favicon not found, continuing without it');
    }
    
    // Set cache headers for static assets in production
    app.use(express.static(path.join(config.root, 'client'), {
      maxAge: '1d',
      setHeaders: function(res, path) {
        // Don't cache HTML files
        if (path.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      }
    }));
    
    app.use('/node_modules', express.static(path.join(config.root, 'node_modules')));
    app.set('appPath', path.join(config.root, 'client'));
    app.use(morgan('combined')); // More detailed logging in production
    
    // Add request timeout middleware
    app.use(function(req, res, next) {
      res.setTimeout(config.requestTimeout, function() {
        console.error('Request timeout: ' + req.url);
        res.status(408).send({ error: 'Request timeout' });
      });
      next();
    });
    
    // Add production error handler
    app.use(function(err, req, res, next) {
      console.error(err);
      res.status(err.status || 500).send({
        message: 'Server error',
        error: {}
      });
    });
  }
};
