'use strict';

var errors = require('./components/errors');
var path = require('path');
var config = require('./config/environment');

module.exports = function(app) {
  // Insert routes below
  app.use('/api/images', require('./api/image'));
  app.use('/api/routes', require('./api/routes'));
  app.use('/api/config', require('./api/config'));

  // All undefined asset or api routes should return a 404
  app.route('/:url(api|auth|components|app|bower_components|assets)/*').get(errors[404]);

  // Determine which handler to use for all other routes
  var useSvelteApp = process.env.USE_SVELTE === 'true';

  if (useSvelteApp) {
    // Use SvelteKit handler for all other routes
    var buildPath = path.join(config.root, 'svelte-app/build');
    var handlerPath = buildPath + '/handler.js';

    console.log('Loading SvelteKit handler from:', buildPath);

    // Load handler once and cache it
    var handlerCache = null;
    var handlerLoadError = null;

    // Middleware that loads handler on first request or retries if failed
    app.use(function(req, res, next) {
      // If handler is already loaded, use it
      if (handlerCache) {
        return handlerCache(req, res, next);
      }

      // If previous load attempt failed, return error
      if (handlerLoadError) {
        console.error('SvelteKit handler not available:', handlerLoadError.message);
        return res.status(500).send({
          error: 'Application not available',
          message: 'SvelteKit build not found. Run: cd svelte-app && pnpm build'
        });
      }

      // Load handler on first request
      import(handlerPath).then(function(module) {
        console.log('SvelteKit handler loaded successfully');
        handlerCache = module.handler;
        handlerCache(req, res, next);
      }).catch(function(err) {
        console.error('Failed to load SvelteKit handler:', err.message);
        console.error('Make sure to build the SvelteKit app first:');
        console.error('  cd svelte-app && pnpm build');
        handlerLoadError = err;
        res.status(500).send({
          error: 'Application not available',
          message: 'SvelteKit build not found. Run: cd svelte-app && pnpm build'
        });
      });
    });
  } else {
    // All other routes should redirect to the index.html (legacy AngularJS)
    app.route('/*').get(function(req, res) {
      res.sendFile(path.resolve(app.get('appPath') + '/index.html'));
    });
  }
};
