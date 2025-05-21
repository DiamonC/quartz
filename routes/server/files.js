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

router.post("/compress/:path", (req, res) => {
  let email = req.headers.username;
  let token = req.headers.token;
  let account = readJSON("accounts/" + email + ".json");
  let serverId = req.params.id;
  if (
    utils.hasAccess(token, account, req.params.id) &&
    fs.existsSync(`servers/${req.params.id}/`)
  ) {
    // Sanitize and normalize the requested path
    let folderPath = utils.sanitizePath(rawPath);
    if (folderPath.includes("*")) {
      folderPath = folderPath.split("*").join("/");
    }

    const fullFolder = `servers/${serverId}/${folderPath}`;
    const folderName = folderPath.split("/").pop();
    const zipName = `${folderName}.zip`;
    const fullZip = `servers/${serverId}/${zipName}`;

    // Ensure the target is a directory
    if (fs.existsSync(fullFolder) && fs.lstatSync(fullFolder).isDirectory()) {
      // Build and run the zip command
      // -r : recurse into directories, -j: junk the paths inside zip if you prefer flat structure
      const cmd = `zip -r "${fullZip}" "${folderName}"`;
      console.log(`cd servers/${serverId} && ${cmd}`);

      exec(cmd, { cwd: `servers/${serverId}` }, (err, stdout, stderr) => {
        if (err) {
          console.error("zip error:", stderr || err);
          return res.status(500).json({ msg: "Compression failed." });
        }
        return res.status(200).json({ msg: "Done", zip: zipName });
      });
    } else {
      return res.status(400).json({ msg: "Invalid folder path." });
    }
  } else {
    return res.status(401).json({ msg: "Invalid credentials." });
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

router.get("/download/:path", function (req, res) {
  console.log(req.query.key, security.getFileAccessKey(req.params.id));
if (req.query.key == security.getFileAccessKey(req.params.id)) {
    let path = utils.sanitizePath(req.params.path);
    if (utils.sanitizePath(req.params.path).includes("*")) {
      path = utils.sanitizePath(req.params.path).split("*").join("/");
    }
    if (fs.existsSync(`servers/${req.params.id}/${path}`)) {
      if (fs.statSync(`servers/${req.params.id}/${path}`).isDirectory()) {
        //zip the folder and send it to the client
        console.log("unzipping");
        console.log(`zip -r -q -X -j ./${path.split("/").join("*")}.zip "${path}"`);
        exec(
          `zip -r -q -X -j ./${path.split("/").join("*")}.zip "${path}"`,
          { cwd: `servers/${req.params.id}/` },
          (err) => {
            res.setHeader("Content-Type", "application/zip");

            res.setHeader(
              "Content-Disposition",
              `attachment; filename=${utils.sanitizePath(req.params.path)}.zip`
            );
            console.log(
              `downloading folder servers/${req.params.id}/${utils.sanitizePath(
                req.params.path
              )}.zip`
            );
            res
              .status(200)
              .download(
                `servers/${req.params.id}/${utils.sanitizePath(req.params.path)}.zip`,
                `${utils.sanitizePath(req.params.path)}.zip`,
                () => {
                  //delete the zip file
                  fs.unlinkSync(
                    `servers/${req.params.id}/${path.split("/").join("*")}.zip`
                  );
                }
              );
          }
        );
      } else {
        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=${utils.sanitizePath(req.params.path)}`
        );
        res.status(200).download(`servers/${req.params.id}/${path}`);
      }
    } else {
      res.status(400).json({ msg: "Invalid request." });
    }
  } else {
    res.status(401).json({ msg: "Invalid credentials." });
  }
});

router.post(
  "/upload/:path",
  upload.single("file"),
  function (req, res) {
    let email = req.headers.username;
    let token = req.headers.token;
    let account = readJSON("accounts/" + email + ".json");
    let server = readJSON("servers/" + req.params.id + "/server.json");
    if (
      utils.hasAccess(token, account, req.params.id) &&
      fs.existsSync(`servers/${req.params.id}/`)
    ) {
      let id = req.params.id;
      let path = utils.sanitizePath(req.params.path);
      let filename = req.query.filename;
      if (utils.sanitizePath(req.params.path).includes("*")) {
        path = utils.sanitizePath(req.params.path).split("*").join("/");
      }

      if (enableVirusScan) {
        console.log(req.file.path);
        exec(
          `clamdscan --multiscan --fdpass ${req.file.path}`,
          {},
          (err, stdout, stderr) => {
            if (stdout.indexOf("Infected files: 0") != -1) {
              loadFile();
            } else {
              res.send("Virus Detected.");
              fs.rmSync(req.file.path);
            }
          }
        );
      } else {
        loadFile();
      }

      function loadFile() {
        fs.copyFileSync(
          req.file.path,
          "servers/" + id + "/" + path + "/" + filename
        );
        fs.rmSync(req.file.path);
        res.status(200).send("Upload Complete.");
      }
    } else {
      res.status(401).json({ msg: "Invalid credentials." });
    }
  }
);

router.get("/", function (req, res) {
  let email = req.headers.username;
  let token = req.headers.token;
  let account = readJSON("accounts/" + email + ".json");
  let server = readJSON("servers/" + req.params.id + "/server.json");

  if (utils.hasAccess(token, account, req.params.id)) {
    if (fs.existsSync(`servers/${req.params.id}/`)) {
      res
        .status(200)
        .json(files.readFilesRecursive(`servers/${req.params.id}/`));
    } else {
      res.status(200).json([]);
    }
  }
});

router.get("/read/:path", function (req, res) {
  let email = req.headers.username;
  let token = req.headers.token;
  let account = readJSON("accounts/" + email + ".json");
  let server = readJSON("servers/" + req.params.id + "/server.json");
  if (utils.hasAccess(token, account, req.params.id)) {
    let path = utils.sanitizePath(req.params.path).split("*").join("/");
    if (fs.existsSync(`servers/${req.params.id}/${path}`)) {
      if (fs.lstatSync(`servers/${req.params.id}/${path}`).isDirectory()) {
        res.status(200).json({
          content:
            "This is a directory, not a file. Listing files: " +
            fs.readdirSync(`servers/${req.params.id}/${path}`),
        });
      } else {
        let extension = path.split(".")[path.split(".").length - 1];

        if (extension == "png" || extension == "jepg" || extension == "svg") {
          res
            .status(200)
            .json({ content: "Image files can't be edited or viewed." });
        } else if (
          extension == "jar" ||
          extension == "exe" ||
          extension == "sh"
        ) {
          res
            .status(200)
            .json({ content: "Binary files can't be edited or viewed." });
        } else if (
          fs.statSync(`servers/${req.params.id}/${path}`).size > 500000
        ) {
          res.status(200).json({ content: "File too large." });
        } else {

          res.status(200).json({
            content: fs.readFileSync(
              `servers/${req.params.id}/${path}`,
              "utf8"
            ),
          });
        }
      }
    } else {
      res.status(200).json([]);
    }
  }
});

router.post("/write/:path", function (req, res) {
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
    let extension = path.split(".")[path.split(".").length - 1];
    let filename = path.split("/")[path.split("/").length - 1];
    if (
      req.body.content !== undefined &&
      fs.existsSync(`servers/${req.params.id}/${path}`) &&
      filename != "server.json" &&
      filename != "modrinth.index.json" &&
      filename != "curseforge.index.json" &&
      fs.statSync(`servers/${req.params.id}/${path}`).size <= 500000
    ) {

      
      let filename = fs.statSync(`servers/${req.params.id}/${path}`).mtimeMs;
      console.log(filename);


      fs.writeFileSync(`servers/${req.params.id}/${path}`, req.body.content);
      res.status(200).json({ msg: "Done" });
    } else {
      res.status(400).json({ msg: "Invalid request." });
    }
  } else {
    res.status(401).json({ msg: "Invalid credentials." });
  }
});

//route to download main folder
router.get("/mainfolder", function (req, res) {

  if (req.query.key == security.getFileAccessKey(req.params.id)) {
    if (fs.existsSync(`servers/${req.params.id}/`)) {
      exec(
        `zip -r -q -X ${req.params.id}.zip .`,
        { cwd: `servers/${req.params.id}` },
        (err) => {
          res.setHeader("Content-Type", "application/zip");

          res.setHeader(
            "Content-Disposition",
            `attachment; filename=${req.params.id}.zip`
          );

          res
            .status(200)
            .download(
              `servers/${req.params.id}/${req.params.id}.zip`,
              `${req.params.id}.zip`,
              () => {
                //delete the zip file
                fs.unlinkSync(`servers/${req.params.id}/${req.params.id}.zip`);
              }
            );
        }
      );
    } else {
      res.status(400).json({ msg: "Invalid request." });
    }
  }
});

module.exports = router;