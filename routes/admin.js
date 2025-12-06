const express = require("express");
const router = express.Router();
const utils = require("../scripts/utils.js");
const schedules = require("../scripts/schedules.js");
const fs = require("fs");
const readJSON = utils.readJSON;

// Middleware to verify admin access (solo mode or has adminAccess flag)
function verifyAdmin(req, res, next) {
  const config = utils.getConfig();
  const email = req.headers.username;
  const token = req.headers.token;

  // Allow solo mode
  if (config.mode === "solo") {
    return next();
  }

  // Check if user has adminAccess flag in provider mode
  if (email && token) {
    try {
      const account = readJSON(`accounts/${email}.json`);
      if (token === account.token && account.adminAccess === true) {
        return next();
      }
    } catch (err) {
      // Error reading account
    }
  }

  return res.status(403).json({ error: "Admin access denied" });
}

router.use(verifyAdmin);

// Get system tasks
router.get("/system-tasks", (req, res) => {
  try {
    const allSchedules = schedules.readSchedules();
    res.json({
      systemTasks: allSchedules.systemTasks || [],
    });
  } catch (err) {
    console.error("Error fetching system tasks:", err);
    res.status(500).json({ error: "Failed to fetch system tasks" });
  }
});

// Get subscriptions and server data
router.get("/subscriptions", (req, res) => {
  try {
    let subscriptions = [];
    let servers = [];

    // Read subscriptions from log file
    if (fs.existsSync("logs/subscriptions.json")) {
      try {
        const subsData = readJSON("logs/subscriptions.json");
        subscriptions = Array.isArray(subsData) ? subsData : [];
      } catch (err) {
        console.error("Error reading subscriptions.json:", err);
      }
    }

    // Read all servers and their data
    if (fs.existsSync("servers")) {
      const serverDirs = fs.readdirSync("servers");

      for (const dir of serverDirs) {
        // Skip non-numeric folders
        if (isNaN(parseInt(dir))) continue;

        const serverId = dir;
        const serverJsonPath = `servers/${serverId}/server.json`;

        if (fs.existsSync(serverJsonPath)) {
          try {
            const serverData = readJSON(serverJsonPath);
            servers.push({
              id: serverId,
              name: serverData.name || null,
              owner: serverData.owner || null,
              software: serverData.software || null,
              accountId: serverData.accountId || null,
            });
          } catch (err) {
            console.error(`Error reading server ${serverId}:`, err);
          }
        }
      }
    }

    res.json({
      subscriptions,
      servers,
    });
  } catch (err) {
    console.error("Error fetching subscriptions:", err);
    res.status(500).json({ error: "Failed to fetch subscriptions" });
  }
});

module.exports = router;
