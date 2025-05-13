const { exec } = require("child_process");
const { promisify } = require("util");
const execPromise = promisify(exec);
const fs = require("fs");
const { ref } = require("process");
const crypto = require("crypto");
const security = require("./security");

const servers = [];

if (!fs.existsSync("./backups")) {
  fs.mkdirSync("./backups");
}



function cycle() {

  let serverFolderItems = fs.readdirSync("./servers");
  for (let i = 0; i < serverFolderItems.length; i++) {
    if (!isNaN(serverFolderItems[i])) {
      servers.push(parseInt(serverFolderItems[i]));
    }
  }

  let serverWorldsTotalSize = 0;

  exec(
    "du -c servers/*/world --max-depth=0 | tail -n 1",
    (error, stdout, stderr) => {
      if (error) {
        console.error(`Error getting total world size: ${stderr}`);
        return;
      }
      serverWorldsTotalSize = parseInt(stdout.split("\t")[0]) * 1024;
    }
  );

  let spaceAvailableOnSystem = 0;
  exec("df --output=avail / | tail -n 1", (error, stdout, stderr) => {
    if (error) {
      console.error(`Error getting available space: ${stderr}`);
      return;
    }
    spaceAvailableOnSystem = parseInt(stdout) * 1024;
  });

  let backupsFolderSize = 0;
  exec("du -c backups | tail -n 1", (error, stdout, stderr) => {
    if (error) {
      console.error(`Error getting total backups size: ${stderr}`);
      return;
    }
    backupsFolderSize = parseInt(stdout.split("\t")[0]);
  });

  let backupSlots = 0;
  setTimeout(() => {
    backupSlots = (
      (spaceAvailableOnSystem - 10 * 1024 * 1024 * 1024 + backupsFolderSize) /
      serverWorldsTotalSize
    ).toFixed(0);
    console.log("BACKUP SLOTS: " + backupSlots);
  }, 1000);

  setTimeout(() => {
    console.log("Running backup cycle...");
    for (let i = 0; i < servers.length; i++) {
      //if we dont space out backups the website will be unreachable for a few minutes.
setTimeout(() => {
  if (!fs.existsSync(`./backups/${servers[i]}`)) {
    fs.mkdirSync(`./backups/${servers[i]}`);
  }

  let backupFolder = fs.readdirSync(`./backups/${servers[i]}`);
  if (backupFolder.length >= backupSlots) {
    let amountToDelete = backupFolder.length - backupSlots;
    for (let j = 0; j <= amountToDelete; j++) {
      fs.rmSync(`./backups/${servers[i]}/${backupFolder[j]}`, {
        recursive: true,
      });
    }
  }
  //backup by zipping the world folder
  const timestamp = Date.now();
  exec(
    `zip -r ./backups/${servers[i]}/${timestamp}.zip ./servers/${servers[i]}/world`,
    (error, stdout, stderr) => {
      if (error) {
        console.error(`Error zipping world folder: ${stderr}`);
        return;
      }
      console.log(`Successfully backed up server ${servers[i]}`);
    }
  );
}, 1000 * i);
    }
  }, 5000);
}

//get the time and make it so it backs up every day at 12am, 6am, 12pm and 6pm uTC
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
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        h,
        0,
        0,
        0
      )
    );
    if (target <= nowUTC) {
      target.setUTCDate(target.getUTCDate() + 1); // next day
    }
    return target - nowUTC;
  });

  const millisTillNext = Math.min(...nextTimes);


  setTimeout(() => {
    cycle();
    setInterval(cycle, 6 * 60 * 60 * 1000); // every 6 hours
  }, millisTillNext);
}

scheduleCycleAtUTC([0, 6, 12, 18]);
let allSlots = [];
function getBackupSlots(serverId) {
  let serverFolder = fs.readdirSync(`./backups/${serverId}`);
  let backupSlots = [];
  for (let i = 0; i < serverFolder.length; i++) {
    const filename = serverFolder[i];
    const timestampStr = filename.split(".")[0];
    const timestamp = Number(timestampStr);

    backupSlots.push({
      id: serverId,
      timestamp: timestamp,
      size: fs.statSync(`./backups/${serverId}/${filename}`).size,
      key: security.getFileAccessKey(serverId),
    });
  }
  backupSlots.sort((a, b) => a.timestamp - b.timestamp);
  allSlots[serverId] = backupSlots;
  return backupSlots;
}


module.exports = { getBackupSlots, };
