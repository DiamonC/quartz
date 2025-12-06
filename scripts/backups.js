const { spawn, exec } = require("child_process");
const { promisify } = require("util");
const execPromise = promisify(exec);
const fs = require("fs").promises;
const security = require("./security");

const servers = [];

// Backup progress tracking
const backupProgress = {};

(async () => {
  try {
    await fs.access("./backups");
  } catch {
    await fs.mkdir("./backups");
  }
})();

async function getServerIds() {
  const items = await fs.readdir("./servers");
  return items.filter((x) => !isNaN(x)).map((x) => parseInt(x));
}

async function getWorldsTotalSize() {
  try {
    const { stdout } = await execPromise(
      "du -c servers/*/world --max-depth=0 | tail -n 1"
    );
    return parseInt(stdout.split("\t")[0]) * 1024;
  } catch (err) {
    console.error("Error getting total world size:", err.message);
    return 0;
  }
}

async function getSpaceAvailable() {
  try {
    const { stdout } = await execPromise("df --output=avail / | tail -n 1");
    return parseInt(stdout) * 1024;
  } catch (err) {
    console.error("Error getting available space:", err.message);
    return 0;
  }
}

async function getBackupsFolderSize() {
  try {
    const { stdout } = await execPromise("du -c backups | tail -n 1");
    return parseInt(stdout.split("\t")[0]);
  } catch (err) {
    console.error("Error getting total backups size:", err.message);
    return 0;
  }
}

async function getWorldFileCount(serverId) {
  try {
    const { stdout } = await execPromise(`find ./servers/${serverId}/world -type f | wc -l`);
    return parseInt(stdout.trim());
  } catch (err) {
    console.error("Error counting files:", err.message);
    return 0;
  }
}

async function runZip(serverId, timestamp) {
  return new Promise(async (resolve, reject) => {
    console.log(`Starting backup for server ${serverId}...`);

    // Get total file count for progress calculation
    const totalFiles = await getWorldFileCount(serverId);
    let filesProcessed = 0;

    backupProgress[serverId] = {
      status: "in_progress",
      progress: 0,
      startTime: Date.now(),
      timestamp: timestamp,
      totalFiles: totalFiles,
      filesProcessed: 0,
    };

    const zip = spawn("zip", [
      "-r",
      `./backups/${serverId}/${timestamp}.zip`,
      `./servers/${serverId}/world`,
    ]);

    // Monitor stdout for file additions
    if (zip.stdout) {
      const readline = require("readline");
      const rl = readline.createInterface({
        input: zip.stdout,
        crlfDelay: Infinity,
      });

      rl.on("line", (line) => {
        // zip outputs lines like "  adding: servers/123/world/file.dat (stored 0%)"
        if (line.includes("adding:")) {
          filesProcessed++;
          if (backupProgress[serverId] && totalFiles > 0) {
            backupProgress[serverId].filesProcessed = filesProcessed;
            backupProgress[serverId].progress = Math.min(
              Math.round((filesProcessed / totalFiles) * 100),
              99
            );
          }
        }
      });

      rl.on("close", () => {
        // stdout closed
      });
    }

    zip.on("close", (code) => {
      if (code === 0 || code === 12) {
        console.log(`Successfully backed up server ${serverId}`);
        if (backupProgress[serverId]) {
          backupProgress[serverId].status = "completed";
          backupProgress[serverId].progress = 100;
          backupProgress[serverId].completedTime = Date.now();
          // Keep progress for 10 seconds then clear
          setTimeout(() => {
            delete backupProgress[serverId];
          }, 10000);
        }
        resolve();
      } else {
        reject(new Error(`Zip failed with code ${code}`));
        if (backupProgress[serverId]) {
          backupProgress[serverId].status = "failed";
          backupProgress[serverId].error = `Zip failed with code ${code}`;
        }
      }
    });

    zip.on("error", (err) => {
      if (backupProgress[serverId]) {
        backupProgress[serverId].status = "failed";
        backupProgress[serverId].error = err.message;
      }
      reject(err);
    });
  });
}

async function cycle() {
  const serverIds = await getServerIds();
  const serverWorldsTotalSize = await getWorldsTotalSize();
  const spaceAvailableOnSystem = await getSpaceAvailable();
  const backupsFolderSize = await getBackupsFolderSize();

  if (serverWorldsTotalSize === 0) {
    console.log("No server worlds found to back up.");
    return;
  }

  const backupSlots = Math.floor(
    (spaceAvailableOnSystem - 10 * 1024 * 1024 * 1024 + backupsFolderSize) /
      serverWorldsTotalSize
  );

  console.log("BACKUP SLOTS:", backupSlots);
  console.log("Running backup cycle...");

  for (let i = 0; i < serverIds.length; i++) {
    console.log(`Attempting to backup server ${serverIds[i]}...`);
    const serverId = serverIds[i];
    await fs.mkdir(`./backups/${serverId}`, { recursive: true });

    const backupFolder = await fs.readdir(`./backups/${serverId}`);

    if (backupFolder.length >= backupSlots) {
      const amountToDelete = backupFolder.length - backupSlots;
      const sorted = backupFolder.sort();

      for (let j = 0; j < amountToDelete; j++) {
        await fs.rm(`./backups/${serverId}/${sorted[j]}`, {
          recursive: true,
          force: true,
        });
      }
    }
    console.log(`Attempting to zip server ${serverIds[i]}...`);
    const timestamp = Date.now();
    try {
      await runZip(serverId, timestamp);
    } catch (err) {
      console.error(`Error backing up server ${serverId}:`, err.message);
    }
  }
}

function scheduleCycleAtUTC(hoursArray) {
  const now = new Date();
  const nowUTC = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours(),
      now.getUTCMinutes(),
      now.getUTCSeconds(),
      now.getUTCMilliseconds()
    )
  );

  const nextTimes = hoursArray.map((h) => {
    const target = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h)
    );
    if (target <= nowUTC) {
      target.setUTCDate(target.getUTCDate() + 1);
    }
    return target - nowUTC;
  });

  const millisTillNext = Math.min(...nextTimes);

  setTimeout(() => {
    cycle();
    setInterval(cycle, 6 * 60 * 60 * 1000);
  }, millisTillNext);
}

scheduleCycleAtUTC([0, 6, 12, 18]);

let allSlots = [];
async function getBackupSlots(serverId) {
  const serverFolder = await fs.readdir(`./backups/${serverId}`);
  let backupSlots = [];
  for (let i = 0; i < serverFolder.length; i++) {
    const filename = serverFolder[i];
    const timestampStr = filename.split(".")[0];
    const timestamp = Number(timestampStr);

    const stats = await fs.stat(`./backups/${serverId}/${filename}`);
    backupSlots.push({
      id: serverId,
      timestamp: timestamp,
      size: stats.size,
      key: security.getFileAccessKey(serverId),
    });
  }
  backupSlots.sort((a, b) => a.timestamp - b.timestamp);
  allSlots[serverId] = backupSlots;

  return backupSlots;
}

function triggerBackupCycle() {
  cycle();
}

function getBackupProgress(serverId) {
  return backupProgress[serverId] || null;
}

module.exports = { getBackupSlots, triggerBackupCycle, getBackupProgress };
