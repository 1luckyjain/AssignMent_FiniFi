const express = require('express');
const router = express.Router();
const { getMatchResult } = require('../controllers/matchController');

router.get('/:poNumber', getMatchResult);

module.exports = router;
