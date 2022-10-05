// importing packages
const express = require('express');
const router = express.Router();
router.get(`/`, function (req, res) {
	res.status(200).json('./storage/accounts/bob.json');
});
router.post(`/`, function (req, res) {
	res.status(200).json({msg: `It's a POST request.`});
});
router.put(`/`, function (req, res) {
	res.status(200).json({msg: `It's a PUT request.`});
});
router.delete(`/`, function (req, res) {
	res.status(200).json({msg: `It's a DELETE request.`});
});
module.exports = router;