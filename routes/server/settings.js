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

router.post(`/`, function (req, res) {
  let email = req.headers.username;
  let token = req.headers.token;
  let account = readJSON("accounts/" + email + ".json");
  let server = readJSON("servers/" + req.params.id + "/server.json");
  if (utils.hasAccess(token, account, req.params.id)) {
    let id = req.params.id;
    iconUrl = req.body.icon;
    desc = req.body.desc;

    if (req.body.newName != undefined && req.body.newName != "") {
      server.name = req.body.newName;
    }

    if (req.body.javaVersion != undefined) {
      server.javaVersion = req.body.javaVersion;
      writeJSON("servers/" + id + "/server.json", server);
    }
    //setting description
    if (f.checkServer(id).software == "velocity") {
      var text = fs.readFileSync(`servers/${id}/velocity.toml`).toString();
      var textByLine = text.split("\n");
      let index = textByLine.findIndex((line) => {
        return line.includes("motd");
      });
      textByLine[index] = `motd = "${desc}"`;
      text = textByLine.join("\n");

      fs.writeFileSync(`servers/${id}/velocity.toml`, text);
    } else {
      if (f.checkServer(id).software == "paper") {
        f.proxiesToggle(
          req.params.id,
          req.body.proxiesEnabled,
          req.body.fSecret
        );
      }
      var text = fs.readFileSync(`servers/${id}/server.properties`).toString();
      var textByLine = text.split("\n");
      let index = textByLine.findIndex((line) => {
        return line.includes("motd");
      });
      textByLine[index] = `motd=${desc}`;
      text = textByLine.join("\n");
      fs.writeFileSync(`servers/${id}/server.properties`, text);
    }

    files.download(`servers/${id}/server-icon.png`, iconUrl);

    //if command "convert" exists, convert the icon to 64x64
    if (fs.existsSync("/usr/bin/convert")) {
      if (fs.existsSync(`servers/${id}/server-icon.png`)) {
        var sizeOf = require("image-size");
        var dimensions = sizeOf(`servers/${id}/server-icon.png`);
        console.log(dimensions.width, dimensions.height);
        if (dimensions.width > 64 || dimensions.height > 64) {
          //if the image is equal in width and height, convert it to 64x64
          if (dimensions.width == dimensions.height) {
            //convert the image to 64x64, make sure its not smaller, squish it if nesescary
            exec(
              `convert servers/${id}/server-icon.png -resize 64x64 servers/${id}/server-icon.png`,
              (err, stdout, stderr) => {
                if (err) {
                  console.log(err);
                } else {
                  console.log("icon resized");
                }
              }
            );
          } else if (dimensions.width > dimensions.height) {
            let ratio = dimensions.width / dimensions.height;

            let newWidth = 64 * ratio;
            let newHeight = 64;

            exec(
              `convert servers/${id}/server-icon.png -resize ${newWidth}x${newHeight} -gravity center -crop 64x64+0+0 +repage servers/${id}/server-icon.png`,
              (err, stdout, stderr) => {
                if (err) {
                  console.log(err);
                }
              }
            );
          } else if (dimensions.width < dimensions.height) {
            //this doesnt work for some reason
          }
        }
      }
    } else {
      console.log("convert command not found, not converting image.");
    }

    //add iconurl.txt to the server folder with the icon url
    fs.writeFileSync(`servers/${id}/iconurl.txt`, iconUrl);
    res.status(200).json({ msg: `Success: Set server info` });
  } else {
    res.status(401).json({ msg: `Invalid credentials.` });
  }
});

router.get(`/`, function (req, res) {
  let email = req.headers.username;
  let token = req.headers.token;
  let account = readJSON("accounts/" + email + ".json");
  let server = readJSON("servers/" + req.params.id + "/server.json");
  if (utils.hasAccess(token, account, req.params.id)) {
    //send the motd and iconUrl
    let iconUrl = "/images/placeholder.webp";
    let desc = "";
    let secret;
    let proxiesEnabled;
    let id = req.params.id;

    if (f.checkServer(id).software == "velocity") {
      var text = fs.readFileSync(`servers/${id}/velocity.toml`).toString();
      var textByLine = text.split("\n");
      let index = textByLine.findIndex((line) => {
        return line.includes("motd");
      });
      desc = textByLine[index].split("=")[1];

      //cut off the quotes
      desc = desc.substring(2, desc.length - 1);
    } else {
      var text = fs.readFileSync(`servers/${id}/server.properties`).toString();
      var textByLine = text.split("\n");
      let index = textByLine.findIndex((line) => {
        return line.includes("motd");
      });
      desc = textByLine[index].split("=")[1];
      try {
        if (f.checkServer(id).software == "paper") {
          secret = fs.readFileSync(
            `servers/${id}/config/paper-global.yml`,
            "utf8"
          );

          let secretLines = secret.split("\n");

          let index2 = secretLines.findIndex((line) => {
            return line.includes("secret:");
          });
          secret = secretLines[index2].split(":")[1].trim();
          //cut quotes off of secret
          secret = secret.substring(1, secret.length - 1);
        }


      let onlineMode = textByLine[
        textByLine.findIndex((line) => {
          return line.includes("online-mode");
        })
      ]
        .split("=")[1]
        .trim();

      if (onlineMode == "true") {
        proxiesEnabled = false;
      } else {
        proxiesEnabled = true;
      }
            } catch (err) {
        console.log(err);
      }
    }

    if (fs.existsSync(`servers/${id}/iconurl.txt`)) {
      iconUrl = fs.readFileSync(`servers/${id}/iconurl.txt`).toString();
    }

    let automaticStartup = false;
try {
      if (server.allowedAccounts == undefined) {
      server.allowedAccounts = "";
    }
    //if allowedAccounts begins with a , remove it
    if (server.allowedAccounts.startsWith(",")) {
      server.allowedAccounts = server.allowedAccounts.substring(1);
    }
    let allowedAccounts1 = server.allowedAccounts.split(",");
    //scan accounts.tsv for each accountId and get the username
    let allowedAccounts = [];
    let accountstsv = fs.readFileSync("accounts.tsv").toString().split("\n");
    for (let i = 0; i < accountstsv.length; i++) {
      let account = accountstsv[i].split("\t");
      if (allowedAccounts1.includes(account[0])) {
        allowedAccounts.push(account[0] + ":" + account[1].split(":")[1]);
      }
    }
} catch (err) {
  console.log(err);
  allowedAccounts = [];
}
    
    res.status(200).json({
      msg: `Success: Got server info`,
      iconUrl: iconUrl,
      desc: desc,
      secret: secret,
      proxiesEnabled: proxiesEnabled,
      automaticStartup: automaticStartup,
      allowedAccounts: allowedAccounts,
      javaVersion: server.javaVersion,
    });
  } else {
    res.status(401).json({ msg: `Invalid credentials.` });
  }
});

module.exports = router;