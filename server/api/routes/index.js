'use strict';

var express = require('express');
var controller = require('./routes.controller');

var router = express.Router();

router.get('/nearby', controller.nearby);


module.exports = router;
