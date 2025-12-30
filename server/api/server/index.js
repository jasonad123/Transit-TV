'use strict';

var express = require('express');
var controller = require('./server.controller');

var router = express.Router();

router.get('/status', controller.getStatus);
router.post('/shutdown', controller.shutdown);
router.post('/start', controller.start);

module.exports = router;
