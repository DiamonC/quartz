const express = require("express");
const router = express.Router();
const fs = require("fs");
let email = "";

const f = require("../scripts/mc.js");
const files = require("../scripts/files.js");
const config = require("../scripts/utils.js").getConfig();
const readJSON = require("../scripts/utils.js").readJSON;
const writeJSON = require("../scripts/utils.js").writeJSON;
const providerMode = JSON.parse(config.providerMode);
const stripeKey = config.stripeKey;
const stripe = require("stripe")(stripeKey);
const security = require("../scripts/security.js");

router.get(`/servers`, function (req, res) {
  email = req.headers.username;
  token = req.headers.token;

  if (!providerMode) email = "noemail";
  //prevents a crash that has occurred
  if (email != undefined) {
    account = readJSON(`accounts/${email}.json`);
    console.log(account);
    console.log("../accounts/" + email + ".json");
  }
  console.log(token + " " + account.token);
  if (token === account.token || !providerMode) {
    //if req.body.email is "noemail" return 404
    if (req.query.username == ("noemail" | "undefined")) {
      //res.status(404).json({ msg: `Invalid email.` });
    }

    if (!providerMode) {

      let serverFolder = fs.readdirSync("servers");
      for (let i = 0; i < serverFolder.length; i++) {
        //only add if theres no server.json file in the folder 
        if (
          !fs.existsSync(`servers/${serverFolder[i]}/server.json`) &&
          !account.servers.includes(serverFolder[i])
        ) {
          //if the server is not in the account.servers array, add it
          account.servers.push(serverFolder[i]);
        }
      }

      //write to account file
      writeJSON(`accounts/noemail.json`, account);
    }


    for (i in account.servers) {


  
        account.servers[i] = parseInt(account.servers[i]);

        let hasValidSubscription = false;
        let subscriptionsJson = readJSON(`logs/subscriptions.json`);
        let resetDate = -1;

        for (let sub of subscriptionsJson) {
      
          if (sub.owner == req.headers.username + ".json") {
                        
            for (let item of sub.subscriptions) {
                
              if (item.plan.active) {
                hasValidSubscription = true;
          
              } else {
         
                            //add 7 days to the current period end if the subscription is canceled
            resetDate = parseInt(item.current_period_end) + 604800;
              }
            }
          }
        }
        console.log("hasValidSubscription: " + hasValidSubscription);
        if (!hasValidSubscription) {
          account.servers[i] = account.servers[i] + ":no valid subscription:" + resetDate;
        } else if (fs.existsSync(`servers/${account.servers[i]}/server.json`)) {
        account.servers[i] = readJSON(
          `servers/${account.servers[i]}/server.json`
        );
        console.log(account.servers[i]);
        account.servers[i].state = f.getState(account.servers[i].id);
        account.servers[i].fileAccessKey = security.getFileAccessKey(account.servers[i].id);
      } else {
        console.log("server is not created yet");
        account.servers[i] = account.servers[i] + ":not created yet";
      }
    }
    res.status(200).json(account.servers);
  } else {
    res.status(401).json({ msg: `Invalid credentials.` });
  }
});

router.get(`/billing`, function (req, res) {
  let email = req.headers.username;
  let token = req.headers.token;
  let account = readJSON(`accounts/${email}.json`);
  if (!providerMode) email = "noemail";
  if (token === account.token || !providerMode) {
    let subscriptionsArray = [];
    stripe.customers.list(
      {
        limit: 100,
        email: account.email,
      },
      function (err, customers) {
        if (err) {
          console.log("err", err);
        } else {
          if (customers.data.length == 0) {
            res.status(200).json({subscriptions: [], servers: []});
            return;
          }
          cid = customers.data[0].id;

          //check the customer's subscriptions and return it
          stripe.subscriptions.list(
            {
              customer: cid,
              limit: 100,
            },
            function (err, subscriptions2) {
          

              for (i in subscriptions2.data) {
                let plan = subscriptions2.data[i].items.data[0].plan;
                try {
                  let name = "basic";
                  if (config.plus == plan.product) name = "plus";
                  if (config.premium == plan.product) name = "premium";
                  subscriptionsArray.push({
                      id: subscriptions2.data[i].id,
                      product: plan.product,
                      name: name,
                      status: subscriptions2.data[i].status,
                      price: plan.amount / 100,
                      interval: plan.interval,
                      currency: plan.currency,
                      created: subscriptions2.data[i].created,
                      canceled_at: subscriptions2.data[i].canceled_at,
                    });
                  
                } catch {

                }
              }
              let serversArray = [];
              for (i in account.servers) {
                if (fs.existsSync(`servers/${account.servers[i]}/server.json`)) {
                  let planName = "basic";
                  if (account.servers[i].productID == config.plus) planName = "plus"; 
                  if (account.servers[i].productID == config.premium) planName = "premium";
                  serversArray.push(account.servers[i].id + ":" + planName);
                } else {
                  serversArray.push(account.servers[i] + ":undefined");
                }
              }
              res.status(200).json({
                subscriptions: subscriptionsArray,
                servers: serversArray,
              });
            }
          );
        }
      }
    );
  } else {
    res.status(401).json({ msg: `Invalid credentials.` });
  }
});

router.get(`/`, function (req, res) {
  //add cors header
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  let returnObject = {};
  //add every non-secret from config and everything from data.json to returnObject
  returnObject["address"] = config.address;
  returnObject["providerMode"] = config.providerMode;
  returnObject["providerMode"] = config.providerMode;
  returnObject["maxServers"] = config.maxServers;
  returnObject["serverStorageLimit"] = config.serverStorageLimit;
  returnObject["enableVirusScan"] = config.enableVirusScan;
  returnObject["enableCloudflareVerify"] = config.enableCloudflareVerify;
  returnObject["cloudflareVerifySiteKey"] = config.cloudflareVerifySiteKey;
  returnObject["enableDeepL"] =
    config.deeplKey != "" && config.deeplKey != null;
  for (var key in readJSON("assets/data.json")) {
    returnObject[key] = readJSON("assets/data.json")[key];
  }
  res.json(returnObject);
});

router.get(`/worldgenMods`, function (req, res) {
  //for each file in worldgen, if it has req.query.version, add filename.split("-")[0] to the returj array
  let wmods = ["terralith", "incendium", "nullscape", "structory"];
  let returnArray = [];
  wmods.forEach((file) => {
    console.log(file);
    if (fs.existsSync(`assets/jars/${file}-${req.query.version}.zip`)) {
      returnArray.push(file.split("-")[0]);
    }
  });

  res.status(200).json(returnArray);
});

router.get(`/jars`, function (req, res) {
  let returnArray = [];
  fs.readdirSync("assets/jars").forEach((file) => {
    if (file.includes(".jar") || file.includes(".zip")) {
      returnArray.push(file);
    }
  });
  //sort
  returnArray = sortFiles(returnArray);
  //reverse
  returnArray.reverse();
  res.status(200).json(returnArray);
});

function sortFiles(files) {
  return files.sort((a, b) => {
      const regex = /([a-zA-Z]+)-(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:\*(\w+))?\.jar|\.zip/;
      const matchA = a.match(regex);
      const matchB = b.match(regex);
      
      const nameA = matchA ? matchA[1] : a;
      const versionA = matchA ? [parseInt(matchA[2]), matchA[3] ? parseInt(matchA[3]) : 0, matchA[4] ? parseInt(matchA[4]) : 0] : [0, 0, 0];
      const preA = matchA ? matchA[5] || '' : '';

      const nameB = matchB ? matchB[1] : b;
      const versionB = matchB ? [parseInt(matchB[2]), matchB[3] ? parseInt(matchB[3]) : 0, matchB[4] ? parseInt(matchB[4]) : 0] : [0, 0, 0];
      const preB = matchB ? matchB[5] || '' : '';

      if (nameA !== nameB && nameA != undefined && nameB != undefined) return nameA.localeCompare(nameB);
      for (let i = 0; i < 3; i++) {
          if (versionA[i] !== versionB[i]) return versionA[i] - versionB[i];
      }
      return preA.localeCompare(preB);
  });
}



router.get(`/jarsIndex`, function (req, res) {
  files.getIndex((index) => {
    index.otherSoftwares = [
      index.terralith,
      index.incendium,
      index.nullscape,
      index.structory,
      index.geyser,
      index.floodgate,
    ];

    index.terralith = null;
    index.incendium = null;
    index.nullscape = null;
    index.structory = null;
    index.geyser = null;
    index.floodgate = null;
    res.status(200).json(index);
  });
});

router.get(`/capacity`, function (req, res) {
  let maxServers = parseInt(config.maxServers);
  let numServers = 0;
  let folders = [];
  fs.readdirSync("servers").forEach((file) => {
    if (fs.existsSync(`servers/${file}/server.json`)) {
      try {
        if (!readJSON(`servers/${file}/server.json`).adminServer) {
          numServers++;
          folders.push(file + ":normal");
        } else {
          folders.push(file + ":admin");
        }
      } catch (e) {
        console.log(e);
        folders.push(file + ":error");
      }
    } else {
      let foundOwner = false;
      try {
        for (i in fs.readdirSync(`accounts`)) {
          if (
            readJSON(
              `accounts/${fs.readdirSync(`accounts`)[i]}`
            ).servers.includes(file)
          ) {
            folders.push(file + ":normal");
            foundOwner = true;
            break;
          }
        }
      } catch (e) {}
      if (!foundOwner) {
        folders.push(file + ":error");
      }
      numServers++;
    }
  });
  console.log("numServers:" + numServers);
  res.status(200).json({
    atCapacity: numServers >= maxServers,
    numServers: numServers,
    maxServers: maxServers,
    folders: folders,
  });
});

router.get(`/accounts`, function (req, res) {
  let forwardingPinReq = req.query.forwardingPin;
  let forwardingPinConfig = config.forwardingPin;
  if (forwardingPinReq == forwardingPinConfig) {
    let accounts =[];
    let accountsTsv = fs.readFileSync("accounts.tsv", "utf8");
    for (let line of accountsTsv.split("\n")) {
      let username = line.split("\t")[1];
      let servers = line.split("\t")[3];
      accounts.push(username + ":" + servers);
    }
    res.status(200).send(accounts);
  } else {
    res.status(401).send(undefined);
  }
});

const { exec } = require("child_process");

function getThreadUsage() {
    return new Promise((resolve, reject) => {
        exec("grep 'cpu[0-9]' /proc/stat", (err, firstSample) => {
            if (err) return reject(err);

            setTimeout(() => {
                exec("grep 'cpu[0-9]' /proc/stat", (err, secondSample) => {
                    if (err) return reject(err);

                    const threads = [];
                    const firstLines = firstSample.trim().split("\n");
                    const secondLines = secondSample.trim().split("\n");

                    for (let i = 0; i < firstLines.length; i++) {
                        const firstParts = firstLines[i].split(/\s+/);
                        const secondParts = secondLines[i].split(/\s+/);

                        const id = firstParts[0]; // "cpu0", "cpu1", ...

                        const firstTotal = firstParts.slice(1, 8).reduce((sum, val) => sum + parseInt(val), 0);
                        const firstIdle = parseInt(firstParts[4]);

                        const secondTotal = secondParts.slice(1, 8).reduce((sum, val) => sum + parseInt(val), 0);
                        const secondIdle = parseInt(secondParts[4]);

                        const totalDiff = secondTotal - firstTotal;
                        const idleDiff = secondIdle - firstIdle;
                        const usage = totalDiff > 0 ? ((totalDiff - idleDiff) / totalDiff) * 100 : 0;

                        threads.push({ id, cpuUsage: usage.toFixed(2) });
                    }

                    resolve(threads);
                });
            }, 500); // 500ms delay between samples
        });
    });
}



// Function to get memory usage
function getMemoryUsage() {
  return new Promise((resolve, reject) => {
      exec("free -m", (err, stdout) => {
          if (err) return reject(err);
          const lines = stdout.trim().split("\n");
          const memValues = lines[1].split(/\s+/);
          const memory = {
              used: parseInt(memValues[2]),
              buffers: parseInt(memValues[5]),
              cached: parseInt(memValues[6]),
              total: parseInt(memValues[1])
          };
          resolve(memory);
      });
  });
}

// Function to get CPU usage
function getCpuUsage() {  
  return new Promise((resolve, reject) => {
      exec(`top -bn1 | grep "Cpu(s)" | awk '{print 100 - $8 "%"}'`, (err, stdout) => {
          if (err) return reject(err);
          const cpu = parseFloat(stdout);
          resolve(cpu); 
      });
  });
}

function getCpuName() {
  return new Promise((resolve, reject) => {
      exec(`cat /proc/cpuinfo | grep "model name" | uniq | sed 's/.*: //'`, (err, stdout) => {
          if (err) return reject(err);
          const cpu = stdout.trim();
          resolve(cpu); 
      }
      );
  });
}

let snapshotHistory = []; // Store past 60 minutes of snapshots
let lastSnapshotTime = 0;

// Function to capture a new snapshot
async function captureSnapshot() {
    try {
        const [threads, memory, cpuUsage, cpuName] = await Promise.all([
            getThreadUsage(),
            getMemoryUsage(),
            getCpuUsage(),
            getCpuName()
        ]);

        let serversOnThreads = f.getServersOnThreads();
        
        const newSnapshot = { timestamp: Date.now(), threads, memory, cpuUsage, cpuName, serversOnThreads };
        snapshotHistory.push(newSnapshot);
        
        // Keep only the past 60 minutes of data
        const hourAgo = Date.now() - 3600000;
        snapshotHistory = snapshotHistory.filter(snapshot => snapshot.timestamp > hourAgo);
        
        lastSnapshotTime = Date.now();
    } catch (error) {
        console.error("Error fetching snapshot info:", error);
    }
}

captureSnapshot();
// Automatically refresh every 60 seconds
setInterval(captureSnapshot, 60000);

// Route to get thread and memory snapshot
router.get("/snapshot", (req, res) => {
    res.json(snapshotHistory);
});

module.exports = router;
