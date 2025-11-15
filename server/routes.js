'use strict';

var errors = require('./components/errors');
var path = require('path');

module.exports = function(app) {
  // Insert routes below
  app.use('/api/images', require('./api/image'));
  app.use('/api/routes', require('./api/routes'));
  app.use('/api/config', require('./api/config'));

  // Theme CSS endpoint
  app.get('/api/theme.css', function(req, res) {
    res.setHeader('Content-Type', 'text/css');
    res.send(`
/* Theme overrides with high specificity */
html :root {
  --primary-color: ${process.env.THEME_PRIMARY_COLOR || '#30b566'} !important;
  --primary-text-color: ${process.env.THEME_PRIMARY_TEXT_COLOR || '#ffffff'} !important;
  --primary-logo-url: url('${process.env.THEME_PRIMARY_LOGO || '/assets/images/transit.svg'}') !important;
  --secondary-logo-url: url('${process.env.THEME_SECONDARY_LOGO || '/assets/images/agency-logo.svg'}') !important;
  --primary-font-family: ${process.env.THEME_FONT_FAMILY || 'Helvetica, Arial, serif'} !important;
}

/* Force header colors with direct CSS since CSS variables aren't working */
header {
  background-color: ${process.env.THEME_PRIMARY_COLOR || '#30b566'} !important;
  color: ${process.env.THEME_PRIMARY_TEXT_COLOR || '#ffffff'} !important;
}

/* Force font family */
header * {
  font-family: ${process.env.THEME_FONT_FAMILY || 'Helvetica, Arial, serif'} !important;
}

/* Secondary logo styling */
${process.env.THEME_SHOW_SECONDARY_LOGO === 'true' ? `
.show-secondary-logo #logo-alt { 
  display: table-cell !important; 
}
#logo-alt a {
  background: url('${process.env.THEME_SECONDARY_LOGO}') no-repeat center left !important;
  background-size: auto 2em !important;
}
` : ''}

/* Primary logo override */
#logo a {
  background: url('${process.env.THEME_PRIMARY_LOGO || '/assets/images/transit.svg'}') no-repeat center left !important;
  background-size: auto 2em !important;
}
    `.trim());
  });

  // All undefined asset or api routes should return a 404
  app.route('/:url(api|auth|components|app|bower_components|assets)/*').get(errors[404]);

  // All other routes should redirect to the index.html
  app.route('/*').get(function(req, res) {
    res.sendFile(path.resolve(app.get('appPath') + '/index.html'));
  });
};
