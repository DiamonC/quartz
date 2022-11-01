const express = require("express");
const router = express.Router();
let techname;

let name = "MySurvival Server";
router.get(`/`, function(req, res) {
	techname = req.headers.techname;
	res.status(200).json({
		server_technical_name: `${techname}`,
		server_name: `${name}`,
		server_status: `online`,
		version: `1.16.5`,
		software: `paper`,
	});
	console.log(req.headers.techname);
});
router.get(`/change-state`, function(req, res) {
	state = req.headers.request;
	if ((state == "start") | (state == "stop") | (state == "restart")) {
		res.status(202).json({ msg: `Success. Server will ${state}.` });
		console.log(req.headers.request);
	} else {
		res
			.status(404)
			.json({ msg: `Invalid state. Valid states are start, stop, & restart.` });
	}
});

router.post(`/new`, function(req, res) {
	//console.log(req.body.software)

	var fs = require('fs')
	var store = (req.body.software + ", " + req.body.version + ", " + req.body.name + "\n")
	console.log(store)
	if(req.body.software != "undefined" && req.body.version != "undefined" && req.body.name != "undefined") {
	fs.appendFile('servers.txt', store, function(err) {
		if (err) {
			// append failed
			console.log("failed to write to file.")
		} else {
			// done
			console.log("written to file.")
		}
	});
	}

	res
		.status(202)
		.json({ msg: `Request recieved.` });
});

module.exports = router;
