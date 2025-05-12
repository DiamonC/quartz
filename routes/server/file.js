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

router.post("/delete/:path", function (req, res) {
  const email = req.headers.username;
  const token = req.headers.token;
  const folder = req.query.folder === "true"; // check if this is a folder deletion

  const account = readJSON("accounts/" + email + ".json");
  const serverPath = `servers/${req.params.id}/`;
  const server = readJSON(`${serverPath}server.json`);

  if (utils.hasAccess(token, account, req.params.id) && fs.existsSync(serverPath)) {
    console.log("unsanitized path: " + req.params.path);
    let path = utils.sanitizePath(req.params.path);
    console.log("sanitized path: " + path);

    if (path.includes("*")) {
      path = path.split("*").join("/");
    }

    const fullPath = `${serverPath}${path}`;
    console.log("DELETING " + fullPath + " " + email);

    if (!fs.existsSync(fullPath)) {
      return res.status(400).json({ msg: "Invalid request." });
    }

    if (folder) {
      // FOLDER DELETE
      if (path.length >= 3) {
        exec(`rm -rf ${fullPath}`, (err) => {
          if (err) {
            console.error(err);
            return res.status(500).json({ msg: "Failed to delete folder." });
          }
          return res.status(200).json({ msg: "Done" });
        });
      } else {
        res.status(400).json({ msg: "Invalid request." });
      }
    } else {
      // FILE DELETE
      const filename = path.split("/").pop();
      if (filename !== "server.json") {
        fs.unlinkSync(fullPath);
        res.status(200).json({ msg: "Done" });
      } else {
        res.status(400).json({ msg: "Invalid request." });
      }
    }
  } else {
    res.status(401).json({ msg: "Invalid credentials." });
  }
});

router.post("/extract/:path", function (req, res) {
  let email = req.headers.username;
  let token = req.headers.token;
  let account = readJSON("accounts/" + email + ".json");
  let server = readJSON("servers/" + req.params.id + "/server.json");
  if (
    utils.hasAccess(token, account, req.params.id) &&
    fs.existsSync(`servers/${req.params.id}/`)
  ) {
    let path = utils.sanitizePath(req.params.path);
    if (utils.sanitizePath(req.params.path).includes("*")) {
      path = utils.sanitizePath(req.params.path).split("*").join("/");
    }
    let filename = path.split("/")[path.split("/").length - 1];
    if (
      fs.existsSync(`servers/${req.params.id}/${path}`) &&
      filename.includes(".zip")
    ) {
      //unzip the file and put it in /servers/id/{filename}
      const exec = require("child_process").exec;
      console.log(
        `unzip -o "servers/` +
          req.params.id +
          `/${path}" -d "servers/` +
          req.params.id +
          `/${filename.split(".zip")[0]}"`
      );
      exec(
        `unzip -o "servers/` +
          req.params.id +
          `/${path}" -d "servers/` +
          req.params.id +
          `/${path.split(".zip")[0]}"`,
        (err, stdout, stderr) => {
          if (err) {
            console.log(err);
          } else {
            res.status(200).json({ msg: "Done" });
          }
        }
      );
    } else {
      res.status(400).json({ msg: "Invalid request." });
    }
  } else {
    res.status(401).json({ msg: "Invalid credentials." });
  }
});


module.exports = router;