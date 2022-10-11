const express = require("express");
const router = express.Router();
let techname;

let name = "MySurvival Server";
router.get(`/`, function (req, res) {
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
router.get(`/change-state`, function (req, res) {
  state = req.headers.request;
  if ((state == "start") | (state == "stop") | (state == "restart")) {
    res.status(202).json({ msg: `Success. Server will ${state}.` });
  } else {
    res
      .status(404)
      .json({ msg: `Invalid state. Valid states are start, stop, & restart.` });
  }
});

module.exports = router;
