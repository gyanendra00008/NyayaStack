const express = require('express');
const { getHealthStatus } = require('../controllers/health.controller.js');

const router = express.Router();

router.get('/', getHealthStatus);

module.exports = router;

