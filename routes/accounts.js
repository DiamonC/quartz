const express = require("express");
const Router = express.Router();
const fs = require("fs");
const s = require("../scripts/stripe.js");
const base62 = require("base62/lib/ascii");

const { v4: uuidv4 } = require("uuid");
const files = require("../scripts/files.js");

const writeJSON = require("../scripts/utils.js").writeJSON;
const config = require("../scripts/utils.js").getConfig();
const readJSON = require("../scripts/utils.js").readJSON;
const enableCloudflareVerify = JSON.parse(config.enableCloudflareVerify);

const nodeName = config.nodeName || "quartz";  

function writeAccount(id, username, billingEmail, servers, stripeServers, freeServers, lastSignin, token, salt, password, resetAttempts) {
  let tsv = fs.readFileSync("accounts.tsv", "utf8").split("\n");
  let row = [id, username, billingEmail, servers, stripeServers, freeServers, lastSignin, token, salt, password, resetAttempts].join("\t") + "\n";
  let alreadyExists = false;
  for (let i in tsv) {
    if (tsv[i].split("\t")[0] == id) {
      alreadyExists = true;
      tsv[i] = row;
    }
  }
  if (!alreadyExists) {
    tsv.push(row);
  }
  fs.writeFileSync("accounts.tsv", tsv.join("\n"));

}
Router.post("/email/signup/", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");

  let account = {};
  let emailExists = false;
  let password = req.body.password;
  let email = req.query.username;
  if (email.includes("email:")) email = email.replace("email:", "");
  let confirmPassword = req.body.confirmPassword;
  let cloudflareVerifyToken = req.query.cloudflareVerifyToken;
  if (enableCloudflareVerify) {
    const exec = require("child_process").exec;
    exec(
      `curl 'https://challenges.cloudflare.com/turnstile/v0/siteverify' --data 'secret=${config.cloudflareVerifySecretKey}&response=${cloudflareVerifyToken}'`,
      (err, stdout, stderr) => {
        try {
          if (JSON.parse(stdout).success) {
            signup();
          } else {
            res
              .status(400)
              .send({ token: -1, reason: "Human Verification Failed" });
          }
        } catch {
          res
            .status(400)
            .send({ token: -1, reason: "Human Verification Failed" });
        }
      }
    );
  } else {
    signup();
  }
  function signup() {

    email = email.toLowerCase();
    try {
      if (fs.existsSync("accounts/email:" + email + ".json")) {
        emailExists = true;
      }

      if (password == confirmPassword) {
        if (password.length >= 7) {
          if (!emailExists) {
            let accountId = "acc_"+base62.encode(nodeName+"*email:"+email.substring(0, 7));
            [salt, password] = files.hash(password).split(":");

            account.password = password;
            account.accountId = accountId;
            account.token = uuidv4();
            account.salt = salt;
            account.resetAttempts = 0;
            account.ips = [];
            account.ips.push(files.getIPID(req.ip));
            account.type = "email";
            account.servers = [];
            account.email = email;
            account.freeServers = 0;
            account.lastSignin = new Date().getTime();
;
            writeJSON("accounts/email:" + email + ".json", account);
            writeAccount(account.accountId, "email:"+email, email, account.servers, 0, account.freeServers, account.lastSignin, account.token, account.salt, account.password, account.resetAttempts);
            res
              .status(200)
              .send({ token: account.token, accountId: accountId });
          } else {
            res.status(400).send({ token: -1, reason: "Email already exists" });
          }
        } else {
          res.status(400).send({ token: -1, reason: "Password is too short" });
        }
      } else {
        res.status(400).send({ token: -1, reason: "Passwords do not match" });
      }
    } catch (err) {
      console.log(err);
      res.status(500).send({ token: -1, reason: "An error occurred" });
    }
  }
});

Router.post("/email/signin/", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");

  let password = req.body.password;
  let email = req.query.username;
  if (email.includes("email:")) email = email.replace("email:", "");
  let account = readJSON("accounts/email:" + email + ".json");
  let response = {};

  let salt = account.salt;
  let cloudflareVerifyToken = req.query.cloudflareVerifyToken;
  if (enableCloudflareVerify) {
    if (account.password != files.hash(password, salt).split(":")[1]) {
      res.status(400).send({ token: -1, reason: "Incorrect email or password" });
    } else {
    const exec = require("child_process").exec;
    exec(
      `curl 'https://challenges.cloudflare.com/turnstile/v0/siteverify' --data 'secret=${config.cloudflareVerifySecretKey}&response=${cloudflareVerifyToken}'`,
      (err, stdout, stderr) => {
        try {
          if (JSON.parse(stdout).success) {
            signin();
          } else {
            res
              .status(400)
              .send({ token: -1, reason: "Human Verification Failed" });
          }
        } catch {
          res
            .status(400)
            .send({ token: -1, reason: "Human Verification Failed" });
        }
      }
    );
    }
  } else {
    signin();
  }
  function signin() {
    if (account.password == files.hash(password, salt).split(":")[1]) {
      if (account.ips.indexOf(files.getIPID(req.ip)) == -1) {
        account.ips.push(files.getIPID(req.ip));
      }
      response = {
        token: account.token,
        accountId: account.accountId,
      };
      account.lastSignin = new Date().getTime();

      writeJSON("accounts/email:" + email + ".json", account);
    } else {
      response = { token: -1, reason: "Incorrect email or password" };
    }

    res.status(200).send(response);
  }
});

Router.delete("/email", (req, res) => {
  email = req.headers.username;
  if (email.includes("email:")) email = email.replace("email:", "");
  password = req.body.password;
  token = req.headers.token;
  let account = readJSON("accounts/email:" + email + ".json");

  if (token == account.token) {
    if (account.password == files.hash(password, account.salt).split(":")[1]) {
      for (i in account.servers) {
        files.removeDirectoryRecursiveAsync("servers/" + account.servers[i]);
      }
      fs.unlinkSync("accounts/email:" + email + ".json");

      res.status(200).send({ success: true });
    } else {
      res.status(400).send({ success: false, reason: "Incorrect password" });
    }
  } else {
    res.status(400).send({ success: false, reason: "Invalid token" });
  }
});

Router.post("/changeToEmail", (req, res) => {
  let email = req.query.email;
  let username = req.headers.username;
  let token = req.headers.token;
  let password = req.body.password;
  let account = readJSON("accounts/" + username + ".json");

  if (token === account.token) {
    account.email = email;
    account.password = files.hash(password).split(":")[1];
    account.salt = files.hash(password).split(":")[0];
    writeJSON("accounts/email:" + username.split(":")[1] + ".json", account);
    writeAccount(account.accountId, "email:"+username.split(":")[1], email, account.servers, 0, account.freeServers, account.lastSignin, account.token, account.salt, account.password, account.resetAttempts);

    res.status(200).send({ success: true });
  } else {
    res.status(400).send({ success: false, reason: "Invalid token" });
  }
});

Router.post("/email/resetPassword/", async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");

  let password = req.body.password;
  let email = req.query.email;
  if (email.includes("email:")) email = email.replace("email:", "");
  let confirmPassword = req.body.confPassword;
  let last4 = req.query.last4;
  let account = readJSON("accounts/email:" + email + ".json");

  try {
    const creditId = await s.getCreditId(email);
    if (account.resetAttempts < 5) {
      if (creditId === last4 || config.enablePay === false) {
        if (password == confirmPassword) {
          if (password.length >= 7) {
            [salt, password] = files.hash(password).split(":");

            account.password = password;
            account.token = uuidv4();
            account.salt = salt;

            res.status(200).send({ success: true });
          } else {
            res
              .status(400)
              .send({ token: -1, reason: "Password is too short" });
          }
        } else {
          res.status(400).send({ token: -1, reason: "Passwords do not match" });
        }
      } else {
        account.resetAttempts++;
        res.status(400).send({
          success: false,
          reason: "Wrong last 4 digits",
          attempts: account.resetAttempts,
        });
      }
    } else {
      res.status(400).send({ success: false, reason: "Too many attempts" });
    }
  } catch (err) {
    console.log(err);
    res.status(500).send({ success: false, reason: "An error occurred" });
  }
  writeJSON("accounts/email:" + email + ".json", account);
  writeAccount(account.accountId,  "email:"+email, email, account.servers, 0, account.freeServers, account.lastSignin, account.token, account.salt, account.password, account.resetAttempts);
});

//combined signin and signup for discord
Router.post("/discord/", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");

  let account = {};
  let nameTaken = false;
  let token = req.query.token;

  exec(
    "curl -X GET https://discord.com/api/users/@me -H 'authorization: Bearer " +
      token +
      "'",
    (req2, res2) => {
      try {
        res2 = JSON.parse(res2);
      } catch {}
      console.log(res2);
      let username = res2.username;

      if (fs.existsSync("accounts/discord:" + username + ".json")) {
        nameTaken = true;
      }
      //if account exists, so the user is signing in not up...
      if (nameTaken) {
        let account = readJSON("accounts/discord:" + username + ".json");
        let response = {};
        account.ips = [];
        if (account.ips.indexOf(files.getIPID(req.ip)) == -1) {
          account.ips.push(files.getIPID(req.ip));
        }
        response = {
          email: account.email,
          token: account.token,
          accountId: account.accountId,
          username: username,
          firstTime: false,
          avatar: `https://cdn.discordapp.com/avatars/${res2.id}/${res2.avatar}.webp`,
          bannerColor: res2.banner_color,
        };
        account.lastSignin = new Date().getTime();
        writeJSON("accounts/discord:" + username + ".json", account);
        writeAccount(account.accountId, "discord:"+username, account.email, account.servers, 0, account.freeServers, account.lastSignin, account.token, account.salt, account.password, account.resetAttempts);
        res.status(200).send(response);
      } else {
        let accountId = "acc_"+base62.encode(nodeName+"*discord:"+username.substring(0, 7));

        account.accountId = accountId;
        account.token = uuidv4();
        account.resetAttempts = 0;

        account.ips = [];
        if (account.ips.indexOf(files.getIPID(req.ip)) == -1) {
          account.ips.push(files.getIPID(req.ip));
        }

        account.type = "discord";
        account.email = res2.email.toLowerCase();
        account.servers = [];
        account.freeServers = 0;
        account.lastSignin = new Date().getTime();
        writeJSON(
          "accounts/discord:" + username.toLowerCase() + ".json",
          account
        );
        writeAccount(account.accountId, "discord:"+username.toLowerCase(), account.email, account.servers, 0, account.freeServers, account.lastSignin, account.token, account.salt, account.password, account.resetAttempts);
        console.log("discord:", res2);
        res.status(200).send({
          token: account.token,
          accountId: accountId,
          username: username.toLowerCase(),
          firstTime: true,
          avatar: `https://cdn.discordapp.com/avatars/${res2.id}/${res2.avatar}.webp`,
          bannerColor: res2.banner_color,
          email: res2.email,
        });
      }
    }
  );
});

Router.delete("/discord", (req, res) => {
  username = req.headers.username;
  token = req.headers.token;
  let account = readJSON("accounts/discord:" + username + ".json");

  if (token == account.token) {
    for (i in account.servers) {
      files.removeDirectoryRecursiveAsync("servers/" + account.servers[i]);
    }

    fs.unlinkSync("accounts/discord:" + username + ".json");

    res.status(200).send({ success: true });
  } else {
    res.status(400).send({ success: false, reason: "Invalid token" });
  }
});

Router.post("/email", (req, res) => {
  let email = req.query.email;
  let accountname = req.headers.accountname;
  let token = req.headers.token;
  let account = readJSON("accounts/" + accountname + ".json");

  if (token === account.token) {
    account.email = email;
    writeJSON("accounts/" + accountname + ".json", account);
    writeAccount(account.accountId, accountname, email, account.servers, 0, account.freeServers, account.lastSignin, account.token, account.salt, account.password, account.resetAttempts);
    res.status(200).send({ success: true });
  }
});

module.exports = Router;
