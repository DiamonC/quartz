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

router.post("/rename", function (req, res) {
  const email   = req.headers.username;
  const token   = req.headers.token;
  const account = readJSON(`accounts/${email}.json`);
  const server  = readJSON(`servers/${req.params.id}/server.json`);

  // 1) check access & server directory exists
  if (!utils.hasAccess(token, account, req.params.id) ||
      !fs.existsSync(`servers/${req.params.id}/`)) {
    return res.status(401).json({ msg: "Invalid credentials." });
  }

  let from = utils.sanitizePath(req.body.from);
  let to   = utils.sanitizePath(req.body.to);

  // disallow attempts to rename core files
  const forbidden = ["server.json", "server.jar", "modrinth.index.json", "curseforge.index.json"];
  if (forbidden.includes(path.basename(from)) ||
      forbidden.includes(path.basename(to))) {
    return res.status(400).json({ msg: "Cannot rename protected files." });
  }

  // normalize any “*” placeholder back to slashes, if you’re using that convention
  from = from.includes("*") ? from.split("*").join("/") : from;

  // only allow a single name in “to” (no sub-dirs)
  if (to.includes("/") || to.includes("*")) {
    return res.status(400).json({ msg: "Invalid new name." });
  }

  const serverRoot = path.resolve(`servers/${req.params.id}`);
  const srcPath    = path.resolve(serverRoot, from);
  const destPath   = path.resolve(serverRoot, path.dirname(from), to);

  // 2) ensure both paths are still under the server folder
  if (!srcPath.startsWith(serverRoot) || !destPath.startsWith(serverRoot)) {
    return res.status(400).json({ msg: "Invalid path." });
  }

  // 3) ensure src exists and dest doesn’t
  if (!fs.existsSync(srcPath)) {
    return res.status(404).json({ msg: "Source not found." });
  }
  if (fs.existsSync(destPath)) {
    return res.status(409).json({ msg: "A file/folder with that name already exists." });
  }

  // 4) perform the rename
  try {
    fs.renameSync(srcPath, destPath);
    return res.status(200).json({ msg: "Rename successful." });
  } catch (err) {
    console.error("Rename error:", err);
    return res.status(500).json({ msg: "Server error during rename." });
  }
});

module.exports = router;