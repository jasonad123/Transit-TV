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

    // Use dynamic import to load ES module handler
    var handlerPromise = import(handlerPath).then(function(module) {
      console.log('SvelteKit handler loaded successfully');
      return module.handler;
    }).catch(function(err) {
      console.error('Failed to load SvelteKit handler:', err.message);
      console.error('Make sure to build the SvelteKit app first:');
      console.error('  cd svelte-app && pnpm build');
      throw err;
    });

    // Middleware that waits for handler to load
    app.use(function(req, res, next) {
      handlerPromise.then(function(handler) {
        handler(req, res, next);
      }).catch(next);
    });
  } else {
    // All other routes should redirect to the index.html (legacy AngularJS)
    app.route('/*').get(function(req, res) {
      res.sendFile(path.resolve(app.get('appPath') + '/index.html'));
    });
  }
};
