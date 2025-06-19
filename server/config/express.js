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

module.exports = function(app) {
  var env = app.get('env');

  app.set('views', config.root + '/server/views');
  app.engine('html', require('ejs').renderFile);
  app.set('view engine', 'html');
  app.use(compression());
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());
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
    app.use(express.static(path.join(config.root, 'client')));
    app.use('/node_modules', express.static(path.join(config.root, 'node_modules')));
    app.set('appPath', path.join(config.root, 'client'));
    app.use(morgan('dev'));
    
    // Add production error handler
    app.use(function(err, req, res, next) {
      console.error(err);
      res.status(err.status || 500).send({
        message: err.message,
        error: {}
      });
    });
  }
};
