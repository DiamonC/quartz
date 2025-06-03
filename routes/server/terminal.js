const express = require("express");
const router = express.Router({ mergeParams: true }); 
const files = require("../../scripts/files.js");
const f = require("../../scripts/mc.js");
const path = require("path");
const utils = require("../../scripts/utils.js");
const multer = require("multer");
const upload = multer({ dest: "assets/uploads/" });
const readJSON = require("../../scripts/utils.js").readJSON;
const data = readJSON("assets/data.json");
const JsDiff = require("diff");
const config = require("../../scripts/utils.js").getConfig();
const ftp = require("../../scripts/ftp.js");
const exec = require("child_process").exec;
const fs = require("fs");
const writeJSON = require("../../scripts/utils.js").writeJSON;
const enableVirusScan = JSON.parse(config.enableVirusScan);
const backups = require("../../scripts/backups.js");
const security = require("../../scripts/security.js");
const providerMode = JSON.parse(config.providerMode);

router.get("/", (req, res) => {
  email = req.headers.username;
  token = req.headers.token;
  account = readJSON("accounts/" + email + ".json");
  server = readJSON("servers/" + req.params.id + "/server.json");
  if (hasAccess(token, account, req.params.id)) {
    res.send(f.readTerminal(req.params.id));
  } else {
    res.status(401).json({ msg: `Invalid credentials.` });
  }
});

router.post("/", (req, res) => {
  email = req.headers.username;
  token = req.headers.token;
  account = readJSON("accounts/" + email + ".json");
  server = readJSON("servers/" + req.params.id + "/server.json");
  if (hasAccess(token, account, req.params.id)) {
    console.log("revieved request: " + req.query.cmd);
    f.writeTerminal(req.params.id, req.query.cmd);
    res.send("Success");
  } else {
    res.status(401).json({ msg: `Invalid credentials.` });
  }
});


function hasAccess(token, account, id) {
  let server = readJSON(`servers/${id}/server.json`);
  if (!providerMode) return true;
  let accountOwner = token === account.token;
  let serverOwner = server.accountId == account.accountId;
  let allowedAccount  = false;
  if (server.allowedAccounts !== undefined) {
    allowedAccount = server.allowedAccounts.includes(account.accountId);
  }

  return accountOwner && (serverOwner || allowedAccount);
}

module.exports = router;