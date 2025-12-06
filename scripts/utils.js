const fs = require("fs");
const { exec } = require("child_process");
const config = getConfig();
const mode = config.mode;
const path = require("path");
const stripe = require("stripe")(config.stripeKey);
const files = require("./files.js");


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
    } else if (!file.includes("servers/") && !file.includes("accounts/")) {
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
  if (mode === "solo") return true;
  let accountOwner = token === account.token;
  let serverOwner = server.accountId == account.accountId;
  let allowedAccount = false;
  if (server.allowedAccounts !== undefined) {
    allowedAccount = server.allowedAccounts.includes(account.accountId);
  }
  if (token.includes("grz")) console.log("Checking access for account: \n" + accountOwner + "\n" + serverOwner + "\n" + allowedAccount);

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

function checkSubscriptions() {
      let servers = fs.readdirSync("servers");
      let data = [];
      for (let i in servers) {
   


        try {
          const serverId = servers[i];
          let storage = 0;
  
          try {
            storage = files.folderSizeRecursive("servers/" + serverId);
          } catch (e) {
            console.log(e);
          }
          if (fs.existsSync(`servers/${serverId}/server.json`)) {
try {
              let json = readJSON(`servers/${serverId}/server.json`);
            if (json.adminServer == undefined || json.adminServer == false) {
              const accountId = json.accountId;
              fs.readdirSync("accounts").forEach((file) => 
                {
                let owner = null;
                        let email = null;
                const account = readJSON(`accounts/${file}`);
                if (account.accountId == accountId && file != "noemail.json") {
                  owner = file;
                  if (!file.includes("email:")) email = account.email;
                  else email = file.split("email:")[1].split(".json")[0];
                  data.push({
                    serverId: servers[i],
                    owner: owner,
                    email: email,
                    storage: storage,
                    accountId: account.accountId,
                  });
                      try {
                        console.log("Getting customer for " + email);
                        if (email != null && email != undefined) {
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
                                  console.log(
                                    "No customer found for " + email
                                  );
                                } else {
                                  console.log(
                                    "Customer found for " + email
                                  );
                                  //find item in data array
                                  //find item in data array
                                  for (let j in data) {
                                    if (data[j].email == email) {
                                      let subscriptionsA = [];

                                      for (let k in customers.data) {
                                        if (customers.data[k].id) {
                                          let customerSubscriptions;
                                          //get from stripe
                                          console.log("Getting subscriptions for customer " + customers.data[k].id);
                                          stripe.subscriptions.list(
                                            {
                                              customer: customers.data[k].id,
                                              status: "all",
                                            },
                                            function (err, subscriptions) {
                                          
                                              if (err) {
                                                console.log("Error getting subscriptions for customer " + customers.data[k].id);
                                                console.log(err);
                                              } else {
                                                 customerSubscriptions = subscriptions.data;
                                                for (let i in customerSubscriptions) {
                                                                                                   subItem = {};
                                                 subItem.status = customerSubscriptions[i].status;
                                                 subItem.ended_at = customerSubscriptions[i].ended_at;
                                                 subItem.current_period_end = customerSubscriptions[i].current_period_end;
                                                 subItem.start_date = customerSubscriptions[i].start_date;
                                                 console.log(customers.data[k].id + " Server Slot " + data[j].serverId + " subscription: ");
                                                  console.log(JSON.stringify(subItem));

                                                  
                                                  subscriptionsA.push(subItem);
                                                  
                                                }
                                              }
                                            }
                                          );
                                        }
                                      }
                                      setTimeout(() => {
                                        data[j].subscriptions = subscriptionsA;
                                        
                                      }, 1000 * 10);
                                    }
                                  }
                                }
                              }
                            }
                          );
                        }
                    } catch (e) {
                      console.log("Error getting customer for " + email);
                      console.log(e);
                    }
                }
              });
            }
} catch (e) {
              console.log("Error getting server owner for " + serverId);
              console.log(e);
            }
          } else {
            fs.readdirSync("accounts").forEach((file) => {
              try {
                let account = readJSON(`accounts/${file}`);
                console.log("Checking account " + file);
                if (
                  account.servers.includes(serverId) ||
                  account.servers.includes(parseInt(serverId))
                  && file != "noemail.json"
                ) {
                  owner = file;
                  if (!file.includes("email:")) email = account.email;
                  else email = file.split("email:")[1].split(".json")[0];
  
                  data.push({
                    serverId: servers[i],
                    owner: owner,
                    email: email,
                    storage: storage,
                    accountId: account.accountId,
                  });
                      try {
                        console.log("Getting customer for " + email);
                        if (email != null && email != undefined) {
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
                                  console.log(
                                    "No customer found for " + email
                                  );
                                } else {
                                  console.log(
                                    "Customer found for " + email
                                  );
                                  //find item in data array
                                  //find item in data array
                                  for (let j in data) {
                                    if (data[j].email == email) {
                                      let subscriptionsA = [];

                                      for (let k in customers.data) {
                                        if (customers.data[k].id) {
                                          let customerSubscriptions;
                                        
                                          stripe.subscriptions.list(
                                            {
                                              customer: customers.data[k].id,
                                              status: "all",
                                            },
                                            function (err, subscriptions) {
                                             
                                              if (err) {
                                                console.log("Error getting subscriptions for customer " + customers.data[k].id);
                                                console.log(err);
                                              } else {
                                                 customerSubscriptions = subscriptions.data;
                                                for (let i in customerSubscriptions) {
                                                                                                   subItem = {};
                                                 subItem.status = customerSubscriptions[i].status;
                                                 subItem.ended_at = customerSubscriptions[i].ended_at;
                                                 subItem.current_period_end = customerSubscriptions[i].current_period_end;
                                                 subItem.start_date = customerSubscriptions[i].start_date;
                                                                                                  console.log(customers.data[k].id + "Server Slot " + data[j].serverId + " subscription: ");
                                                 console.log(subItem);
                                              
                                                  subscriptionsA.push(subItem);
                                                  
                                                }
                                              }
                                            }
                                          );
                                        }
                                      }
                                      setTimeout(() => {
                                        data[j].subscriptions = subscriptionsA;
                                        
                                      }, 1000 * 10);
                                    }
                                  }
                                }
                              }
                            }
                          );
                        }
                    } catch (e) {
                      console.log("Error getting customer for " + email);
                      console.log(e);
                    }
                }
              } catch (error) {
                console.log("error scanning account " + file);
                console.log(error);
                data = [];
              }
            });
          }
        } catch {
          console.log("error getting server owner");
        }
      }
      setTimeout(() => {
        console.log("Subscriptions 50% done checking.");
      }
      , 1000 * 30);  
      setTimeout(() => {
        fs.writeFileSync(
          "logs/subscriptions.json",
          JSON.stringify(data, null, 2)
        );
        console.log("Subscriptions checked and logged.");
        //stop any servers with no active subscriptions
        for (let i in data) {

          if (data[i].subscriptions == undefined) {
            console.log("No subscriptions found for " + data[i].serverId);
            continue;
          }
          let adminServer = false;
          try {
            let serverJson = readJSON(`servers/${data[i].serverId}/server.json`);
            if (serverJson.adminServer == true) {
              console.log("Skipping admin server " + data[i].serverId);
              adminServer = true;
              continue;
            }
          } catch (e) {
            console.log("Error reading server.json for " + data[i].serverId);
            console.log(e);
          }
          console.log("Checking server " + data[i].serverId);
          let isActiveSubscription = false;
          let latestEndDate = 0;
          let latestStartDate = 0;
          if (data[i].subscriptions != undefined) {
            for (let j in data[i].subscriptions) {
              if (
                data[i].subscriptions[j].status == "active"
              ) {
                isActiveSubscription = true;
                break;
              } else {
                if (data[i].subscriptions[j].ended_at > latestEndDate) {
                  latestEndDate = data[i].subscriptions[j].ended_at;
                }
                if (data[i].subscriptions[j].start_date > latestStartDate) {
                  latestStartDate = data[i].subscriptions[j].start_date;
                }
              }
            }
          }
          //if latestStart date was within the past 24 hours, then well mark it as an active subscription
          //this is because the subscriptions.json file may not have been refreshed yet
          if (latestStartDate > Date.now() - 1000 * 60 * 60 * 24) {
            isActiveSubscription = true;
          }
          if (!isActiveSubscription) {
            console.log("Stopping server " + data[i].serverId + " due to no active subscriptions.");
            const f = require("./mc.js");
            f.stopAsync(data[i].serverId, () => {
              console.log("Server " + data[i].serverId + " stopped.");
            });
            let timeToTrash = Date.now() - latestEndDate > 1000 * 60 * 60 * 24 * 7;
            let newOwner = false;
            if (fs.existsSync(`servers/${data[i].serverId}/server.json`))
             newOwner = !(readJSON(`servers/${data[i].serverId}/server.json`).accountId == data[i].accountId);
            console.log("New Owner? " + newOwner);
            console.log("Time to trash? " + timeToTrash);
            if (timeToTrash && !adminServer && !newOwner) {
            //if it has been 7 days since the latest cancellation date, move to trashbin
if (Date.now() - latestEndDate > 1000 * 60 * 60 * 24 * 7) {
  console.log("Checking Stripe subscriptions for " + data[i].email + " before moving server " + data[i].serverId);
  
  // Search for customer by email
  stripe.customers.list({
    email: data[i].email,
    limit: 1
  })
  .then(customers => {
    let hasActiveSubscription = false;

    if (customers.data.length > 0) {
      const customerId = customers.data[0].id;
      
      // Get all subscriptions for this customer
      return stripe.subscriptions.list({
        customer: customerId,
        status: 'active',
        limit: 100
      });
    } else {
      // No customer found, return empty result
      return { data: [] };
    }
  })
  .then(subscriptions => {
    // Check if any active subscriptions exist
    if (subscriptions.data.length > 0) {
      console.log("Found active subscription(s) for " + data[i].email + ", skipping server " + data[i].serverId);
      return; // Exit early if subscriptions found
    }

    // Only proceed with moving to trashbin if no active subscriptions found
    console.log("No active subscriptions found. Moving server " + data[i].serverId + " to trashbin.");
    let logLine = "server " + data[i].serverId + " moved to trashbin. Subscription data: \n" + JSON.stringify(data[i], null, 2) + "\n";
    
    if (!fs.existsSync("logs/trashbin.log")) {
      fs.writeFileSync("logs/trashbin.log", "");
    }
    fs.appendFileSync("logs/trashbin.log", logLine);
    
    if (!fs.existsSync("trashbin")) {
      fs.mkdirSync("trashbin");
    }

    try {
      if (fs.existsSync(`servers/${data[i].serverId}`) && !fs.existsSync(`trashbin/${data[i].serverId}-${data[i].owner.split(".json")[0]}`)) {
        fs.renameSync(
          `servers/${data[i].serverId}`,
          `trashbin/${data[i].serverId}-${data[i].owner.split(".json")[0]}`
        );
        
        // Sometimes an empty folder is left behind, so we delete it
        if (fs.existsSync(`servers/${data[i].serverId}`)) {
          fs.rmSync(`servers/${data[i].serverId}`, { recursive: true, force: true });
        }
        
        // In the account file, add :freed to the serverId
        let account = readJSON(`accounts/${data[i].owner}`);
        if (account.servers.includes(data[i].serverId)) {
          account.servers = account.servers.filter(
            (server) => server !== data[i].serverId
          );
          account.servers.push(data[i].serverId + ":freed");
          writeJSON(`accounts/${data[i].owner}`, account);
        }
      } else if (fs.existsSync(`servers/${data[i].serverId}`)) {
        console.log("Deleting empty server folder " + data[i].serverId);
        fs.rmSync(`servers/${data[i].serverId}`, { recursive: true, force: true });
      }
    } catch (e) {
      console.log("Error moving server to trashbin " + data[i].serverId);
      console.log(e);
    }
  })
  .catch(stripeError => {
    console.log("Error checking Stripe subscriptions for " + data[i].email);
    console.log(stripeError);
    // Optionally: you can decide whether to proceed with deletion or skip on Stripe errors
  });
}

          } else {
            console.log("Server " + data[i].serverId + " has an active subscription.");
          }
          
        }
      }
      }, 1000 * 60);
}

const subdomainCleanup = require('./subdomainCleanup');

/**
 * Run periodic tasks including subscription checks and subdomain cleanup
 */
function runPeriodicTasks() {
  console.log('Running periodic tasks...');
  
  // Check subscriptions
  checkSubscriptions();
  
  // Schedule subdomain cleanup to run after subscription check completes
  setTimeout(() => {
    try {
      // Run subdomain cleanup
      subdomainCleanup.cleanupInactiveSubdomains();
    } catch (error) {
      console.error('Error running subdomain cleanup:', error);
    }
  }, 1000 * 90); // Run 90 seconds after subscription check starts (30 seconds after it should complete)
  
  // Schedule next run (every 24 hours)
  setTimeout(runPeriodicTasks, 1000 * 60 * 60 * 24);
}

module.exports = { 
  getConfig, 
  readJSON, 
  writeJSON, 
  refreshPermissions, 
  hasAccess, 
  sanitizePath, 
  checkSubscriptions,
  runPeriodicTasks
};
