const fs = require("fs");
const { exec } = require("child_process");
const config = getConfig();
const enableAuth = JSON.parse(config.enableAuth);
const path = require("path");


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

function hasAccess(token, account, id) {
  let server = readJSON(`servers/${id}/server.json`);
  if (!enableAuth) return true;
  let accountOwner = token === account.token;
  let serverOwner = server.accountId == account.accountId;
  let allowedAccount = false;
  if (server.allowedAccounts !== undefined) {
    allowedAccount = server.allowedAccounts.includes(account.accountId);
  }
  if (token.includes("62d")) console.log("Checking access for account: \n" + accountOwner + "\n" + serverOwner + "\n" + allowedAccount);

  return accountOwner && (serverOwner || allowedAccount);
}

function sanitizePath(userInput) {
  // Step 1: Block null bytes (common in attacks)
  if (userInput.includes("\0")) {
    console.log("null byte blocked: " + userInput);
    return "invalid";
  }

  // Step 2: Normalize the path to resolve `..` and `.`
  const normalized = path.normalize(userInput);

  // Step 3: Split into parts and filter out traversal attempts
  const parts = normalized.split(path.sep); // Handles OS-specific separators
  const filteredParts = parts.filter((part) => {
    // Reject empty parts (e.g., from leading/trailing slashes)
    if (part === "") return false;
    // Block parent directory traversal
    if (part === "..") return false;
    return true;
  });

  // Step 4: Rebuild the sanitized path
  const sanitized = filteredParts.join(path.sep);

  // Step 5: Block absolute paths (e.g., /etc/passwd or C:\Windows)
  if (path.isAbsolute(sanitized)) {
    console.log("absolute path blocked: " + sanitized);
    return "invalid";
  }

  return sanitized;
}

module.exports = { getConfig, readJSON, writeJSON, refreshPermissions, hasAccess, sanitizePath };
