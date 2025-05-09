const express = require("express");
const Router = express.Router();
let stripeKey = require("../scripts/utils.js").getConfig().stripeKey;
const stripe = require("stripe")(stripeKey);
const config = require("../scripts/utils.js").getConfig();
const utils = require("../scripts/utils.js");
const files = require("../scripts/files.js");
const f = require("../scripts/mc.js");
const s = require("../scripts/stripe.js");

Router.get("/verifyToken", (req, res) => {
  let tempToken = req.query.tempToken;
  try {
    const datajson = utils.readJSON("assets/data.json");
    if (datajson.tempToken.split(":")[1] == tempToken) {
      res.status(200).send({ success: true });
    } else {
      res.status(200).send({ success: false });
    }
  } catch (error) {
    res.status(500).send({ error: error });
  }
});

Router.get("/account/:accountId", async (req, res) => {
  let tempToken = req.query.tempToken;
  if (tempToken == utils.readJSON("assets/data.json").tempToken.split(":")[1]) {
    let accountsFolder = fs.readdirSync("accounts");
    console.log("finding account for " + req.params.accountId);
    for (let i in accountsFolder) {
      try {
        let account = utils.readJSON(`accounts/${accountsFolder[i]}`);
        if (account.accountId == req.params.accountId) {
          let accountSend = {};
          accountSend.accountId = account.accountId;
          accountSend.name = accountsFolder[i].split(".json")[0];
          accountSend.email = account.email;
          accountSend.resetAttempts = account.resetAttempts;
          accountSend.type = account.type;
          accountSend.servers = account.servers;
          accountSend.freeServers = account.freeServers;
          accountSend.lastSignIn = account.lastSignIn;
          res.status(200).send(accountSend);
          return;
        }
      } catch (error) {
        console.log(error);
      }
    }
  } else {
    res.status(401).send({ error: "Unauthorized" });
  }
});

Router.get("/customers", async (req, res) => {
  const datajson = utils.readJSON("assets/data.json");
  if (req.query.tempToken != datajson.tempToken.split(":")[1]) {
    res.status(401).send({ error: "Unauthorized" });
  } else {
       s.getCustomers(async (err, customers) => {
      if (err) {
        console.error("Error fetching customers:", err);
        return res.status(500).send({ error: "Internal server error" });
      }

    res.status(200).send(customers);
       });
  }
});

Router.get("/subscriptions/:email", async (req, res) => {
  const datajson = utils.readJSON("assets/data.json");
  if (req.query.tempToken != datajson.tempToken.split(":")[1]) {
    res.status(401).send({ error: "Unauthorized" });
  } else {
    try {
      const customer = await s.getSubscriptions(req.params.email);
      console.log("customer", customer);
      
      if (!customer) {
        return res.status(404).send({ error: "Customer not found" });
      }
      
      res.status(200).send(customer);
    } catch (err) {
      console.error("Error fetching customer:", err);
      res.status(500).send({ error: "Internal server error" });
    }
  }
});



const { execSync } = require("child_process");
Router.get("/servers", async (req, res) => {
  const datajson = utils.readJSON("assets/data.json");
  if (req.query.tempToken != datajson.tempToken.split(":")[1]) {
    res.status(401).send({ error: "Unauthorized" });
  } else {
    let servers = fs.readdirSync("servers");
    let data = [];
    for (let i in servers) {
      let owner = null;
      let email = null;
      try {
        const serverId = servers[i];
        let storage = 0;

        try {
          storage = files.folderSizeRecursive("servers/" + serverId);
        } catch (e) {
          console.log(e);
        }
        if (fs.existsSync(`servers/${serverId}/server.json`)) {
          let json = utils.readJSON(`servers/${serverId}/server.json`);
          if (json.adminServer == undefined || json.adminServer == false) {
            const accountId = json.accountId;
            fs.readdirSync("accounts").forEach((file) => {
              const account = utils.readJSON(`accounts/${file}`);
              if (account.accountId == accountId) {
                owner = file;
                if (!file.includes("email:")) email = account.email;
                data.push({
                  serverId: servers[i],
                  owner: owner,
                  email: email,
                  storage: storage,
                });
              }
            });
          }
        } else {
          fs.readdirSync("accounts").forEach((file) => {
            try {
              let account = utils.readJSON(`accounts/${file}`);

              if (
                account.servers.includes(serverId) ||
                account.servers.includes(parseInt(serverId))
              ) {
                owner = file + "?";
                if (!file.includes("email:")) email = account.email + "?";

                data.push({
                  serverId: servers[i],
                  owner: owner,
                  email: email,
                  storage: storage,
                });
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
    res.status(200).send(data);
  }
});

Router.post("/freeExpiredServer", async (req, res) => {
  const datajson = utils.readJSON("assets/data.json");
  if (req.query.tempToken != datajson.tempToken.split(":")[1]) {
    res.status(401).send({ error: "Unauthorized" });
  } else {
    try {
      let serverId = req.query.serverId;
      let owner = req.query.owner;
      let account = utils.readJSON(`accounts/${owner}.json`);
      let servers = account.servers;
      let newServers = [];
      for (let i in servers) {
        if (servers[i] != serverId && servers[i] != parseInt(serverId)) {
          newServers.push(servers[i]);
        }
      }
      account.servers = newServers;
      utils.writeJSON(`accounts/${owner}`, account);
      utils.removeDirectoryRecursiveAsync(`servers/${serverId}/*`);
      res.status(200).send({ success: true });
    } catch (error) {
      res.status(500).send({ error: error });
    }
  }
});
module.exports = Router;
