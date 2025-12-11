'use strict';

var express = require('express');
var controller = require('./server.controller');

var router = express.Router();

router.get('/status', controller.getStatus);
router.post('/shutdown', controller.shutdown);
router.post('/start', controller.start);
router.post('/restart', controller.restart);

module.exports = router;
