// Override console.log to consolidate duplicate logs and append timestamps
(function () {
  const originalLog = console.log;
  const logCache = { lastMessage: null, count: 0 };

  function getTimestamp() {
    return new Date().toISOString().replace("T", " ").split(".")[0];
  }

  console.log = function (message, ...optionalParams) {
    if (logCache.lastMessage === message) {
      logCache.count++;
    } else {
      if (logCache.count > 0) {
        originalLog(`[${getTimestamp()}] ${logCache.lastMessage} (repeated ${logCache.count} times)`);
      }
      logCache.lastMessage = message;
      logCache.count = 0;
      originalLog(`[${getTimestamp()}] ${message}`, ...optionalParams);
    }
  };

  process.on("exit", () => {
    if (logCache.count > 0) {
      originalLog(`[${getTimestamp()}] ${logCache.lastMessage} (repeated ${logCache.count} times)`);
    }
  });
})();


// importing packages
const express = require("express");
const app = express();
const path = require("path");
const cors = require("cors");


const fs = require("fs");
const crypto = require("crypto");
const files = require("./scripts/files.js");
const scraper = require("./scripts/scraper.js");


if (!fs.existsSync("config.txt")) {
  //migration from old way of storing settings to config.txt
  if (
    fs.existsSync("stores/settings.json") &&
    fs.existsSync("stores/secrets.json")
  ) {
    fs.unlinkSync("stores/settings.json");
    fs.unlinkSync("stores/secrets.json");
  }
  //quit process and tell them to "node setup"
  console.log(
    "Please run 'node setup' to set up quartz first."
  );
  process.exit(1);
} else {
  //this compares the current config.txt to the template, and adds any new settings to the config.txt
  let template = fs
    .readFileSync("assets/template/config.txt")
    .toString()
    .split("\n");
  let current = fs.readFileSync("config.txt").toString().split("\n");
  for (let i in template) {
    for (let j in current) {
      if (template[i].includes("=") && current[j].includes("=")) {
        let templateLine = template[i].split("=")[0];
        let currentLine = current[j].split("=")[0];
        if (templateLine == currentLine) {
          //pepper and forwardingSecret need to have random values generated
          if (
            (templateLine == "pepper" || templateLine == "forwardingSecret") &&
            current[j].split("=")[1] == ""
          ) {
            template[i] =
              template[i].split("=")[0] +
              "=" +
              crypto
                .createHash("sha256")
                .update(current[j].split("=")[1])
                .digest("hex");
          } else if (
            templateLine == "forwardingSecret" &&
            !current[j].includes("hash_")
          ) {
            template[i] =
              template[i].split("=")[0] +
              "=hash_" +
              files.hashNoSalt(current[j].split("=")[1]);
          } else if (current[j].split("=")[1] == "undefined") {
            template[i] = template[i].split("=")[0] + "=";
          } else {
            template[i] =
              template[i].split("=")[0] + "=" + current[j].split("=")[1];
          }
        }
      }
    }
  }

  //mechanism to make sure config isn't being messed up
  let providerMode;
  let stripeKey;
  for (let i in template) {
    if (template[i].includes("stripeKey")) {
      stripeKey = template[i].split("=")[1];
    }
  }
  for (let i in current) {
    if (current[i].includes("providerMode")) {
      providerMode = current[i].split("=")[1];
    }
  }

  if (!(providerMode == "true" && stripeKey.split("").length < 10)) {
    fs.writeFileSync("config.txt", template.join("\n"));
  } else {
    console.log("Error with writing config. Exiting...");
    process.exit(1);
  }
}

if (!fs.existsSync("logs")) {
  fs.mkdirSync("logs");
}


const f = require("./scripts/mc.js");





if (!fs.existsSync("accounts")) {
  fs.mkdirSync("accounts");
  fs.writeFileSync(
    "accounts/noemail.json",
    `{"accountId":"noemail", "servers":[]}`
  );
}

if (!fs.existsSync("./servers")) {
  fs.mkdirSync("servers");
} else if (fs.existsSync("./servers/template")) {
  fs.rmSync("./servers/template", { recursive: true });
}
const ftp = require("./scripts/ftp.js");
const security = require("./scripts/security.js");
const backups = require("./scripts/backups.js");


try {ftp.startFtpServer();} catch (e) {
  console.log("Error starting FTP server " + e);
}

const migrations = require("./scripts/migrations.js");

if (!fs.existsSync("accounts.tsv")) {
  migrations.accountsToTSV();
}
if (!fs.existsSync("servers.tsv")) {
  migrations.serversToTSV();
}
exec = require("child_process").exec;


//if owner and group aren't 1000 warn the user to change it
if (fs.statSync("servers").gid != 100) {
  console.log(
    "Warning: FTP may not work. Please run sudo chown yourusername:100 -R servers/ and sudo chmod 2770 -R servers/ to fix this."
  );
}
require("dotenv").config();
if (!fs.existsSync("./backup")) {
  fs.mkdirSync("backup");
}
if (!fs.existsSync("./backup/disabledServers")) {
  fs.mkdirSync("backup/disabledServers");
}







const utils = require("./scripts/utils.js");
const readJSON = utils.readJSON;
const writeJSON = utils.writeJSON;
const checkSubscriptions = utils.checkSubscriptions;

//Migration from old file-based servers & accounts format from 1.2 to the 1.3 folder-based one
if (fs.existsSync("accounts.json") && fs.existsSync("servers.json")) {
  const oldAccounts = require("./accounts.json");
  const oldServers = require("./servers.json");
  for (i in oldAccounts) {
    let newAccount = {};
    newAccount = oldAccounts[i];
    newAccount.servers = [];
    newAccount.email = i;
    for (j in oldServers) {
      if (oldServers[j].accountId == oldAccounts[i].accountId) {
        oldServers[j].id = j;
        newAccount.servers.push(oldServers[j]);
        writeJSON(`servers/${j}/server.json`, oldServers[j]);
      }
    }
    writeJSON(`accounts/${i}.json`, newAccount);
  }

  fs.copyFileSync("accounts.json", "backup/accounts.json");

  fs.unlinkSync("accounts.json");
  fs.copyFileSync("servers.json", "backup/servers.json");
  fs.unlinkSync("servers.json");
}

fs.readdirSync("accounts").forEach((file) => {
  //if account is from old email-only system, this adds the "email:" prefix
  if (
    file.includes("@") &&
    !file.includes("email:") &&
    file.split(":")[1] == undefined
  ) {
    fs.renameSync(`accounts/${file}`, `accounts/email:${file}`);
  }
});

const s = require("./scripts/stripe.js");

let modVersions = [{ c: "modded", s: "forge", v: "1.19.4" }];

const config = require("./scripts/utils.js").getConfig();
const stripe = require("stripe")(config.stripeKey);

if (!fs.existsSync("assets/jars")) {
  fs.mkdirSync("assets/java");
  fs.mkdirSync("assets/jars");
  fs.mkdirSync("assets/jars/downloads");
  fs.mkdirSync("assets/uploads");
 
  fs.writeFileSync(
    "assets/data.json",
    `{"lastUpdate":${Date.now()},"numServers":0,"tempToken":"${Date.now()}:${crypto.randomBytes(3).toString("hex")}","serverStates": []}`
  );
  refreshTempToken();
  downloadJars("full");
}
//clears uploads directory
fs.readdirSync("assets/uploads").forEach((file) => {
  fs.unlinkSync(`assets/uploads/${file}`);
});

const datajson = readJSON("./assets/data.json");
if (Date.now() - datajson.lastUpdate > 1000 * 60 * 60 * 6) {
  downloadJars("partial");
  checkSubscriptions();
  // Start periodic tasks (includes subscription checks and subdomain cleanup)
  utils.runPeriodicTasks();
  backup();
  refreshTempToken();
  refreshFileAccess();
  removeUnusedAccounts();
}
setInterval(() => {
  downloadJars("partial");
}, 1000 * 60 * 60 * 2);
setInterval(() => {

  checkSubscriptions();
  // Start periodic tasks (includes subscription checks and subdomain cleanup)
  utils.runPeriodicTasks();
  backup();
  refreshTempToken();
  refreshFileAccess();
  removeUnusedAccounts();
}, 1000 * 60 * 60 * 12);

setInterval(() => {
  downloadJars("full");
}, 1000 * 60 * 60 * 24);

function refreshTempToken() {
  const datajson = readJSON("./assets/data.json");

  if (datajson.tempToken == undefined) {
    datajson.tempToken =
      Date.now() + ":" + crypto.randomBytes(3).toString("hex");
  }
  if (datajson.tempToken.split(":")[1].split("").length != 6) {
    datajson.tempToken =
      Date.now() + ":" + crypto.randomBytes(3).toString("hex");
  }
  if (datajson.tempToken.split("").length < 10) {
    datajson.tempToken =
      Date.now() + ":" + crypto.randomBytes(3).toString("hex");
    writeJSON("assets/data.json", datajson);
  } else {
    //if its more than 90 days old, refreshe it
    if (Date.now() - datajson.tempToken.split(":")[0] > 1000 * 60 * 60 * 24 * 90) {
      datajson.tempToken =
        Date.now() + ":" + crypto.randomBytes(3).toString("hex");
    writeJSON("assets/data.json", datajson);
  }
}
}

function downloadJars(type) {
  const datajson = readJSON("./assets/data.json");
  datajson.lastUpdate = Date.now();
  

  writeJSON("assets/data.json", datajson);
  if (type == "full") {	
  scraper.fullDownload();
  } else if (type == "partial") {
    scraper.partialDownload();
  }

  setTimeout(() => {
    const scraperjson = readJSON("./assets/scraper.json");
      let downloads = [];
  for (let i in scraperjson) {
    if (scraperjson[i].includes("https://")) {
      downloads.push({filename: i, url: scraperjson[i], status: "downloading"});
    }
  }



      try {
  
      let counter = 0;
      for (i in scraperjson) {
        counter++;
        try {
          //create downloads folder if it doesn't exist
          if (!fs.existsSync("assets/jars/downloads")) {
            fs.mkdirSync("assets/jars/downloads");
          }
        let filename = i;

        let url = scraperjson[i];
        let software = filename.split("-")[0];
        let version = filename.split("-")[1];
        let extension = filename.split(".")[filename.split(".").length - 1];
        let channel = "";
        if (filename.split("-").length > 2) {

         channel = filename.split("-")[2].split("."+extension)[0];
        if (channel == "release") {
          channel = "";
        } else {
          channel = "*" + channel;
        }
      } else {
        version = version.split("."+extension)[0];
      } 
        let newFilename = `${software}-${version}${channel}.${extension}`;
        setTimeout(() => {
        files.downloadAsync("assets/jars/downloads/"+newFilename, url, (data) => {
          if (data == "error") {
                    for (let j in downloads) {
          if (downloads[j].filename == filename) {
            downloads[j].status = "failed";
          }
        }
          }
          try {
                      if (fs.existsSync(`assets/jars/${newFilename}`)) {
            fs.unlinkSync(`assets/jars/${newFilename}`);
          }
          fs.copyFileSync(
            `assets/jars/downloads/${newFilename}`,
            `assets/jars/${newFilename}`
          );
          fs.unlinkSync(`assets/jars/downloads/${newFilename}`);
          //change the status of the download to downloaded

          for (let j in downloads) {
            if (downloads[j].filename == filename) {
              downloads[j].status = "downloaded";
            }
          }
          } catch (e) {
            console.log("Error copying file: " + e);
            //change the status of the download to failed
            for (let j in downloads) {
              if (downloads[j].filename == filename) {
                downloads[j].status = "failed";
              }
            }
          }
        });
      }, 200 * counter);

      } catch (e) {
        console.log("Error downloading file: " + e);
        //change the status of the download to failed
        for (let j in downloads) {
          if (downloads[j].filename == filename) {
            downloads[j].status = "failed";
          }
        }
      }
    }
  } catch (e) {
    console.log("Error reading jar links: " + e);
  }
      setInterval(() => {
    let amountDownloaded = 0; 
    for (let i in downloads) {
      if (downloads[i].status == "downloaded") {
        amountDownloaded++;
      }
    }

    fs.writeFileSync("logs/downloads.json", JSON.stringify(downloads, null, 2));
  }, 1000);
  
  }, 1000 * 15);


    
 
}

function backup() {
  console.log("Backing up");
  try {
    console.log("Backing up");
    if (JSON.parse(config.enableBackups)) {
      let backupsList = config.backupsList.split(",");
      let spaceLimit = 512;

      for (i in backupsList) {
        if (backupsList[i] != "") {
          //if backupsList[i]'s last character is a /, remove it
          if (backupsList[i].charAt(backupsList[i].length - 1) == "/") {
            backupsList[i] = backupsList[i].slice(0, -1);
          }

          //date in dd-mm-yyyy format
          let date = new Date();
          let day = date.getDate();
          let month = date.getMonth() + 1;
          let year = date.getFullYear();
          let date2 = day + "-" + month + "-" + year;
          if(!fs.existsSync(`/${backupsList[i]}/quartz-backups`)){
            fs.mkdirSync(`/${backupsList[i]}/quartz-backups`);
          }
          let currentSpace = 0;
          currentSpace = files.getFolderSize(`/${backupsList[i]}/quartz-backups`);
          //convert it to GB
          currentSpace = parseInt(currentSpace) / 1000000000;
          if (fs.existsSync(`/${backupsList[i]}/quartz-backups/${date2}`)) {
            console.log("Backup already exists for " + backupsList[i]);
          } else if (currentSpace + 64 >= spaceLimit) {
            console.log("Backup space limit reached for " + backupsList[i]);
          } else {
          exec(
            `rsync -a --delete . /${backupsList[i]}/quartz-backups/${date2}`,
            (err, stdout, stderr) => {
              if (err) {
                console.log(err);
              } else {
                console.log("Backup to " + backupsList[i] + " successful");
              }
            }
          );
        }
        }
      }
    }
  } catch (e) {
    console.log("Backup error: " + e);
  }
}




function removeUnusedAccounts() {
  const accounts = fs.readdirSync("accounts");
  for (let i = 0; i < accounts.length; i++) {
    const account = readJSON(`accounts/${accounts[i]}`);

    //there is no system to tell file creation date accurately yet
    let openedRecently =
      account.lastSignin > Date.now() - 1000 * 60 * 60 * 24 * 30;

    let hasServers = account.servers != null && account.servers.length > 0;

    if (!hasServers && !openedRecently) {
      let email;
      if (accounts[i].includes("email:"))
        email = accounts[i].split("email:")[1];
      else email = account.email;
      console.log(email);
      if (email != undefined) {
        //checks stripe to see if the account has a subscription
        stripe.customers.list(
          {
            limit: 100,
            email: email,
          },
          function (err, customers) {
            if (err) {
              console.log("err", err);
            } else {
              if (customers.data.length == 0) {
                console.log("Removing unused account" + accounts[i]);
                fs.unlinkSync(`accounts/${accounts[i]}`);
                if (!fs.existsSync("assets/deletions-log.txt")) {
                  fs.writeFileSync(
                    "assets/deletions-log.txt",
                    "[" +
                      new Date().toLocaleString() +
                      "] " +
                      accounts[i] +
                      " was deleted due to inactivity.\n"
                  );
                } else {
                  fs.appendFileSync(
                    "assets/deletions-log.txt",
                    "[" +
                      new Date().toLocaleString() +
                      "] " +
                      accounts[i] +
                      " was deleted due to inactivity.\n"
                  );
                }
              }
            }
          }
        );
      }
    }
  }
}

//crash handling
// Process-wide error handling
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  setTimeout(() => {
    let numServersOnline = 0;
    fs.readdirSync("servers").forEach((file) => {
      if (f.getState(file) == "true") {
        numServersOnline++;
      }
    });
    if (numServersOnline == 0) {
      console.log("Crash was fatal. Exiting...");
      process.exit(1);
    }
  }, 10000);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception thrown:", error);
  setTimeout(() => {
    let numServersOnline = 0;
    fs.readdirSync("servers").forEach((file) => {
      if (f.getState(file) == "true") {
        numServersOnline++;
      }
    });
    if (numServersOnline == 0) {
      console.log("Crash was fatal. Exiting...");
      process.exit(1);
    }
  }, 10000);
});

//This handles commands from the terminal
process.stdin.setEncoding("utf8");

process.stdout.write(
  'Welcome to the terminal!\nType "help" for a list of commands.\n'
);
let userInput = false;
process.stdin.on("data", (data) => {
  const input = data.trim(); // Remove leading/trailing whitespace
  switch (input) {
    case "stop":
    case "end":
    case "exit":
      process.exit(0);
    case "help":
      console.log(
        "Commands:\nstop\nend\nexit\nbackup\nnumServersOnline\ngetServerOwner\ngetDashboardToken\nscanAccountIds\nscanAccountServers\nbroadcast\nhelp\nclear - clears the terminal\nrefresh - downloads the latest jars, gets the latest version, verifies subscriptions, and cleans up inactive subdomains. This automatically runs every 12 hours.\ncleanupSubdomains - manually triggers the subdomain cleanup process\n"
      );
      break;
    case "backup":
      backup();
      break;
    case "numServersOnline":
      let numServersOnline = 0;
      fs.readdirSync("servers").forEach((file) => {
        if (f.getState(file) == "true") {
          numServersOnline++;
        }
      });
      console.log(
        numServersOnline +
          " - " +
          (numServersOnline / parseInt(fs.readdirSync("servers").length)) *
            100 +
          "%"
      );
      break;
    case "getServerOwner":
      userInput = true;
      console.log("Enter server id:");
      process.stdin.once("data", (data) => {
        try {
          const serverId = data.trim();
          if (fs.existsSync(`servers/${serverId}/server.json`)) {
            const accountId = readJSON(
              `servers/${serverId}/server.json`
            ).accountId;
            fs.readdirSync("accounts").forEach((file) => {
              const account = readJSON(`accounts/${file}`);
              if (account.accountId == accountId) {
                console.log(file);
                if (!file.includes("email:")) console.log(account.email);
              }
            });
          } else {
            fs.readdirSync("accounts").forEach((file) => {
              try {
                let account = readJSON(`accounts/${file}`);
                if (account.servers.includes(serverId)) {
                  console.log(file);
                  if (!file.includes("email:")) console.log(account.email);
                }
              } catch {
                console.log("error scanning account " + file);
              }
            });
          }
        } catch {
          console.log("error getting server owner");
        }
      });
      break;
    case "getDashboardToken":
      refreshTempToken();
      const datajson2 = readJSON("./assets/data.json");
      console.log(datajson2.tempToken.split(":")[1]);
      break;
    case "broadcast":
      userInput = true;
      console.log(
        `Enter broadcast message (ex: "Server shutting down in 5 minutes"):`
      );
      process.stdin.once("data", (data) => {
        const message = data.trim();
        for (let i in fs.readdirSync("servers")) {
          const serverId = fs.readdirSync("servers")[i];
          f.writeTerminal(serverId, "say [Broadcast] " + message);
        }
        console.log("Broadcasted message to all servers.");
        userInput = false;
      });

      break;
    case "scheduleRestart":
      userInput = true;
      console.log(
        `Enter restart time in minutes (ex: "5" for 5 minutes):`
      );
      process.stdin.once("data", (data) => {
        const time = data.trim();
        for (let i in fs.readdirSync("servers")) {
          const serverId = fs.readdirSync("servers")[i];
          f.writeTerminal(
            serverId,
            "say [Broadcast] Server restarting in " + time + " minutes to update our systems."
          );
          
        }
        //five minute reminder
        setTimeout(() => {
          for (let i in fs.readdirSync("servers")) {
            const serverId = fs.readdirSync("servers")[i];
            f.writeTerminal(
              serverId,
              "say [Broadcast] Server restarting in 5 minutes to update our systems."
            );
          }
        }, (time - 5) * 60 * 1000); 
        console.log("Restart scheduled in " + time + " minutes.");
        console.log("Make sure the autorestart script is working.");
        setTimeout(() => {
          setTimeout(() => {
            //end the process
            console.log("Exiting...");
            process.exit(0);
          }
          , 1000 * 5);
          //send stop commands to all servers
          for (let i in fs.readdirSync("servers")) {
            const serverId = fs.readdirSync("servers")[i];
            f.stopAsync(serverId, () => {
              console.log("Server " + serverId + " stopped.");
            });
          }

        }, time * 60 * 1000);
 
        userInput = false;
      });

      break;
    case "runMigrations":
      console.log("Running migration 1");
      migrations.migration1();
      break;
    case "clear":
      process.stdout.write("\x1B[2J\x1B[0f");
      break;
    case "refresh":
      downloadJars("full");
      checkSubscriptions();
      utils.runPeriodicTasks();
      refreshTempToken();
      removeUnusedAccounts();
      refreshFileAccess();
      
      console.log("downloading latest jars, verifying subscriptions, and cleaning up subdomains...");
      break;
    case "scanAccountIds":
      fs.readdirSync("accounts").forEach((file) => {
        try {
          let account = readJSON(`accounts/${file}`);
          console.log(account.accountId + " - " + file);
        } catch {
          console.log("error scanning account " + file);
        }
      });
      break;
    case "scanAccountServers":
      fs.readdirSync("accounts").forEach((file) => {
        try {
          let account = readJSON(`accounts/${file}`);
          console.log(file + " - " + account.servers);
        } catch {
          console.log("error scanning account " + file);
        }
      });
      break;
    case "cleanupSubdomains":
      console.log("Manually triggering subdomain cleanup...");
      const subdomainCleanup = require('./scripts/subdomainCleanup');
      subdomainCleanup.cleanupInactiveSubdomains();
      break;
    default:
      if (!userInput) {
        console.log('Unknown command. Type "help" for a list of commands.');
      }
  }
});

function refreshFileAccess() {
  security.refreshKeys();
  setTimeout(() => {
    try {
      ftp.startFtpServer();
    } catch (e) {
      console.log("Error starting FTP server " + e);
    }
  }, 1000);
}

let stdout = "";
process.stdout.write = (function (write) {
  return function (string, encoding, fd) {
    stdout += string;
    write.apply(process.stdout, arguments);
  };
})(process.stdout.write);

//this logs the terminal every 5 minutes
setInterval(() => {
  if (stdout != "") {
    fs.writeFileSync("logs/terminal.txt", stdout);
  }
}, 1000 * 60 * 5);


//this gets the server states every 5 minutes so that if quartz restarts, servers that were up will startup again
function getServerStates() {
  const data = readJSON("./assets/data.json");

  console.log("Previous server states");
  console.log(data.serverStates);
  
  // Keep track of previous states before clearing
  const previousStates = {};
  if (data.serverStates) {
    data.serverStates.forEach(state => {
      const [id, status] = state.split(":");
      previousStates[id] = status;
    });
  }

  // Initialize serverStates if it doesn't exist
  if (!data.serverStateDetails) {
    data.serverStateDetails = {};
  }

  data.serverStates = [];
  
  fs.readdirSync("servers").forEach((file) => {
    const currentState = f.getState(file);
    data.serverStates.push(file + ":" + currentState);

    // Initialize or update detailed state tracking
    if (!data.serverStateDetails[file]) {
      data.serverStateDetails[file] = {
        shouldBeRunning: currentState === "true",
        lastState: currentState,
        failureCount: 0,
        lastFailure: null,
        lastSuccess: currentState === "true" ? Date.now() : null
      };
    } else {
      // Update state details
      if (currentState === "false" && previousStates[file] === "true") {
        // Server just failed
        data.serverStateDetails[file].failureCount++;
        data.serverStateDetails[file].lastFailure = Date.now();
      } else if (currentState === "true") {
        // Server is running successfully
        data.serverStateDetails[file].failureCount = 0;
        data.serverStateDetails[file].lastSuccess = Date.now();
        data.serverStateDetails[file].shouldBeRunning = true;
      }
      
      // If server was running before and failed, maintain shouldBeRunning state
      if (data.serverStateDetails[file].shouldBeRunning && currentState === "false") {
        // Only attempt restart if within reasonable limits
        const timeSinceLastFailure = Date.now() - (data.serverStateDetails[file].lastFailure || 0);
        const maxRetries = 3;
        const retryWindowMs = 15 * 60 * 1000; // 15 minutes
        
        if (data.serverStateDetails[file].failureCount <= maxRetries && timeSinceLastFailure > 5 * 60 * 1000) {
          // Wait 5 minutes between retry attempts
          console.log(`Attempting to restart failed server ${file} (Attempt ${data.serverStateDetails[file].failureCount} of ${maxRetries})`);
          setTimeout(() => {
            f.run(parseInt(file), undefined, undefined, undefined, undefined, undefined, false);
          }, 5000); // Small delay before retry
        } else if (data.serverStateDetails[file].failureCount > maxRetries) {
          console.log(`Server ${file} has failed ${data.serverStateDetails[file].failureCount} times. Manual intervention required.`);
          // Reset failure count after retry window
          if (timeSinceLastFailure > retryWindowMs) {
            data.serverStateDetails[file].failureCount = 0;
          }
        }
      }
      
      data.serverStateDetails[file].lastState = currentState;
    }
  });

  writeJSON("./assets/data.json", data);
}

//automatic server start-up system
const data = readJSON("./assets/data.json");
console.log("Server states");
console.log(data.serverStates);

// Initialize state details if not present
if (!data.serverStateDetails) {
  data.serverStateDetails = {};
}

// Process servers that should be running
for (i in data.serverStates) {
  if (data.serverStates[i] != null) {
    let id = parseInt(data.serverStates[i].split(":")[0]);
    let state = data.serverStates[i].split(":")[1];
    
    // Initialize state details for this server if needed
    if (!data.serverStateDetails[id]) {
      data.serverStateDetails[id] = {
        shouldBeRunning: state === "true",
        lastState: state,
        failureCount: 0,
        lastFailure: null,
        lastSuccess: state === "true" ? Date.now() : null
      };
    }
    
    // Check if server should be running (either was running or is marked as shouldBeRunning)
    if ((state === "true" || data.serverStateDetails[id].shouldBeRunning) && 
        fs.existsSync("servers/" + id + "/server.json") &&
        f.getState(id) === "false") {
      
      // Calculate delay based on number of servers and position
      let multiplier = data.serverStates.length / 16;
      let random = Math.floor(Math.random() * 24) + 1;
      let startupDelay = 2400 * random * multiplier;
      
      console.log(`Scheduling startup for server ${id} in ${startupDelay/1000} seconds`);
      
      setTimeout(() => {
        // Double check state before starting
        if (f.getState(id) === "false") {
          console.log(`Starting server ${id} as part of startup sequence`);
          f.run(id, undefined, undefined, undefined, undefined, undefined, false);
        }
      }, startupDelay);
    }
  }
}

// Save the updated state
writeJSON("./assets/data.json", data);

setInterval(() => {
  getServerStates();
}, 1000 * 60 * 3);

app.get("/", (req, res) => {
  res.status(200).sendFile(path.join(__dirname, "assets/clientMessage.html"));
});
const rateLimit = require("express-rate-limit");


const limiter = rateLimit({
  max: 300,
  windowMs: 1000,
  message: "Too many request from this IP",
});

/*const security = (req, res, next) => {
  if (req.url.includes("/accounts/")) {
    next();
  } else {
    accounts = require("./accounts.json");

    if (accounts[req.headers.username].ips != undefined) {
      if (accounts[req.headers.username].ips.includes(files.getIPID(req.ip))) {
        next();
      } else {
        res.status(403).send({
          status: "ERROR",
          error: "IP not allowed",
        });
      }
    }
  }
};*/
// middlewares
app.use(limiter, express.json(), cors());

app.use("/server", require("./routes/server/index.js"));
app.use("/checkout", require("./routes/checkout"));
app.use("/info", require("./routes/info"));
app.use("/accounts", require("./routes/accounts"));
app.use("/curseforge", require("./routes/curseforge"));
app.use("/translate", require("./routes/translate"));
app.use("/node", require("./routes/node"));
app.use("/referrals", require("./routes/referrals"));

//support for extensions

const extensionsPath = path.join(__dirname, 'extensions');
if (fs.existsSync(extensionsPath)) {
  fs.readdirSync(extensionsPath).forEach(file => {
    if (file.endsWith('.js')) {
      const extRouter = require(path.join(extensionsPath, file));
      const routeName = file.replace('.js', '');
      app.use(`/x/${routeName}`, extRouter);
      console.log(`Loaded extension: /x/${routeName}`);
    }
  });
}

const adminApp = express();
const adminPort = process.env.ADMIN_PORT || 4001;




// Admin-specific middleware stack
adminApp.use(express.json(), cors());
adminApp.use((req, res, next) => {
  console.log(`Admin access: ${req.method} ${req.path}`);
  next();
});


// Error handling for admin routes
adminApp.use((err, req, res, next) => {
  console.error('Admin route error:', err);
  res.status(500).json({ error: 'Internal admin server error' });
});

// Start admin server
adminApp.listen(adminPort, () => {
  console.log(`Admin API running on port ${adminPort}`);
});

adminApp.use("/", require("./routes/dashboard"));

// port
const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Listening on Port: ${port}`));

app.use((err, req, res, next) => {
  switch (err.message) {
    case "NoCodeProvided":
      return res.status(400).send({
        status: "ERROR",
        error: err.message,
      });
    default:
      return res.status(500).send({
        status: "ERROR",
        error: err.message,
      });
  }
});
