const fs = require("fs");

function getConfig() {
  let configTxt = fs.readFileSync("config.txt", "utf8").split("\n");
  let config = {};
  configTxt.forEach((line) => {
    if (line.includes("=")) {
      let splitLine = line.split("=");
      config[splitLine[0]] = splitLine[1];
    }
  });
  return config;
}

function readJSON(file) {
  let json = {};
  try {
    if (fs.existsSync(file)) {
      json = JSON.parse(fs.readFileSync(file, "utf8"));
    } else {
      console.log(file + " does not exist.");
    }
  } catch (error) {
    console.log("error parsing json for " + file, error);
  }
  return json;
}

function writeJSON(file, json) {
  if (file.includes("accounts/")) {
    console.log("WRITING TO " + file);
    console.log(json);
  }
  try {
    fs.writeFileSync(file, JSON.stringify(json, null, 2));
  } catch (error) {
    console.log("error writing json for " + file, error);
  }
}

function refreshPermissions() {
  const { exec } = require("child_process");
  exec("sudo chown sysadmin:100 -R servers/", (error, stdout, stderr) => {
    if (error) {
      console.error(`Error setting permissions: ${error}`);
      return;
    }
    exec("sudo chmod 2776 -R servers/", (error, stdout, stderr) => {
      if (error) {
        console.error(`Error setting permissions: ${error}`);
        return;
      }
      console.log("Permissions set successfully.");
      return;
    }); 
 
  });
}

module.exports = { getConfig, readJSON, writeJSON, refreshPermissions };
