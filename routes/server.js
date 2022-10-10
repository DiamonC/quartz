const express = require('express');
const router = express.Router();
let techname;

let name = "MySurvival Server"
router.get(`/`, function (req, res) {
	 techname = req.headers.techname;
	res.status(200).json({server_technical_name: `${techname}`, server_name: `${name}`, server_status: `online`});
    console.log(req.headers.techname);
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