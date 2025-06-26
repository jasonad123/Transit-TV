'use strict';

var express = require('express');
var controller = require('./config.controller');

var router = express.Router();

router.get('/unattended', controller.getUnattendedConfig);

module.exports = router;