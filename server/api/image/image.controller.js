'use strict';

var request = require('request');

// Get one image
exports.show = function (req, res) {
  var imageName = req.params.id,
    primaryColor = req.query.primaryColor || '010101',
    secondaryColor = req.query.secondaryColor || 'EFEFEF';

  var suffix = primaryColor === '000000' ? '-mono' : '-color-light',
    filename = imageName.replace('.svg', '') + suffix + '.svg',
    url = 'https://transitapp-data.com/images/svgx/' + filename;

  request({
    url: url,
  }, function (err, response, data) {
    if (err) {
      return handleError(res, err);
    }

    try {
      data = data.replace(new RegExp(`#010101`, 'gi'), `#${primaryColor}`)
        .replace(new RegExp(`#EFEFEF`, 'gi'), `#${secondaryColor}`);
    } catch (err) {
      return handleError(res, err);
    }

    res.status(200).set(response.headers).send(data);
  });
};

function handleError(res, err) {
  return res.status(500).send(err);
}
