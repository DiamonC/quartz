const { spawn, exec } = require("child_process");
const { promisify } = require("util");
const path = require("path");
const execPromise = promisify(exec);
const fs = require("fs").promises;
const security = require("./security");
const fsp = require("fs").promises;

const servers = [];

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



// Helper: get total size of directory
async function getDirSize(dir) {
let total = 0;
const entries = await fsp.readdir(dir, { withFileTypes: true });
for (const entry of entries) {
const fullPath = path.join(dir, entry.name);
if (entry.isDirectory()) {
total += await getDirSize(fullPath);
} else {
const stats = await fsp.stat(fullPath);
total += stats.size;
}
}
return total;
}


// Backup function with progress estimation
async function runZip(serverId, timestamp) {
const srcPath = `./servers/${serverId}/world`;
const destDir = `./backups/${serverId}`;
const destFile = path.join(destDir, `${timestamp}.zip`);
console.log(destFile);

await fsp.mkdir(destDir, { recursive: true });


// Get total size before starting
let totalSize = 0;
try {
totalSize = await getDirSize(srcPath);
} catch (err) {
console.error(`Failed to calculate size for ${serverId}:`, err);
}


return new Promise((resolve, reject) => {
let processedSize = 0;
const zip = spawn("zip", ["-r", "-v", destFile, "world"], { cwd: `./servers/${serverId}` });


const progressTimer = setInterval(() => {
if (totalSize > 0) {
const percent = ((processedSize / totalSize) * 100).toFixed(2);
console.log(`[${serverId}] Backup progress: ${percent}%`);
} else {
console.log(`[${serverId}] Backup still running...`);
}
}, 30000);


zip.stdout.on("data", async (data) => {
const line = data.toString();
const match = line.match(/\s*adding: (.+)/);
if (match) {
const filePath = path.join(srcPath, match[1].trim());
try {
const stats = await fsp.stat(filePath);
processedSize += stats.size;
} catch (e) {
// ignore missing files
}
}
});


zip.stderr.on("data", (data) => {
console.error(`[${serverId}] zip error: ${data}`);
});


zip.on("close", (code) => {
clearInterval(progressTimer);
if (code === 0 || code === 12) {
console.log(`[${serverId}] Backup complete: ${destFile}`);
resolve();
} else {
reject(new Error(`zip exited with code ${code}`));
}
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

module.exports = { getBackupSlots, triggerBackupCycle };
