'use strict';

var request = require('request');

// Get one image
exports.show = function (req, res) {
  // Validate input parameters
  if (!req.params.id) {
    return res.status(400).json({ error: 'Image ID is required' });
  }
  
  var imageName = req.params.id,
    primaryColor = req.query.primaryColor || '010101',
    secondaryColor = req.query.secondaryColor || 'EFEFEF';
    
  // Validate color format (should be a valid hex color without the # prefix)
  var hexColorRegex = /^[0-9A-Fa-f]{6}$/;
  if (!hexColorRegex.test(primaryColor) || !hexColorRegex.test(secondaryColor)) {
    return res.status(400).json({ 
      error: 'Invalid color format. Colors must be 6-character hex values without the # prefix' 
    });
  }

  var suffix = primaryColor === '000000' ? '-mono' : '-color-light',
    filename = imageName.replace('.svg', '') + suffix + '.svg',
    url = 'https://transitapp-data.com/images/svgx/' + filename;

  request({
    url: url,
    timeout: 10000 // 10 second timeout
  }, function (err, response, data) {
    if (err) {
      console.error('Error fetching image:', err);
      return handleError(res, 'Failed to fetch image');
    }
    
    if (!response || response.statusCode !== 200) {
      console.error('Error response from image API:', response ? response.statusCode : 'No response');
      return handleError(res, 'Image not found or unavailable', response ? response.statusCode : 404);
    }
    
    if (!data) {
      return handleError(res, 'Empty response from image server');
    }

    try {
      data = data.replace(new RegExp(`#010101`, 'gi'), `#${primaryColor}`)
        .replace(new RegExp(`#EFEFEF`, 'gi'), `#${secondaryColor}`);
    } catch (err) {
      console.error('Error processing image data:', err);
      return handleError(res, 'Failed to process image data');
    }

    res.status(200).set(response.headers).send(data);
  });
};

function handleError(res, err, statusCode) {
  console.error('Image API error:', err);
  return res.status(statusCode || 500).json({ error: err });
}
