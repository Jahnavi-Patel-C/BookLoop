const express = require('express');
const router = express.Router();
const { getDevUsers, getCurrentDevUser } = require('../controllers/devUserController');

router.get('/dev-users', getDevUsers);
router.get('/dev-users/current', getCurrentDevUser);

module.exports = router;

