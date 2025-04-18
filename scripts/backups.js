const { exec } = require("child_process");
const { promisify } = require("util");
const execPromise = promisify(exec);
const fs = require("fs");

const servers = [];

if (!fs.existsSync("./backups")) {
  fs.mkdirSync("./backups");
}

function cycle() {
  //getting info
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
    console.log("BACKUP SLOTS" + backupSlots);
  }, 1000);

  setTimeout(() => {
    console.log("Running backup cycle...");
    for (let i = 0; i < servers.length; i++) {
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
      exec(
        `zip -r ./backups/${
          servers[i]
        }/${Date.now().toString()}.zip ./servers/${servers[i]}/world`,
        (error, stdout, stderr) => {
          if (error) {
            console.error(`Error zipping world folder: ${stderr}`);
            return;
          }
          console.log(`Successfully backed up server ${servers[i]}`);
        }
      );
    }
  }, 5000);
}

//get the time and make it so it backs up every day at 12am, 6am, 12pm and 6pm

let now = new Date();
let millisTill12 =
  new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0) - now;
if (millisTill12 < 0) {
  millisTill12 += 86400000; // it's after 12am, try 12am tomorrow.
}
let millisTill6 =
  new Date(now.getFullYear(), now.getMonth(), now.getDate(), 6, 0, 0, 0) - now;
if (millisTill6 < 0) {
  millisTill6 += 86400000; // it's after 6am, try 6am tomorrow.
}
let millisTill12pm =
  new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0) - now;
if (millisTill12pm < 0) {
  millisTill12pm += 86400000; // it's after 12pm, try 12pm tomorrow.
}
let millisTill6pm =
  new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0, 0, 0) - now;
if (millisTill6pm < 0) {
  millisTill6pm += 86400000; // it's after 6pm, try 6pm tomorrow.
}

let millisTillBackup = Math.min(
  millisTill12,
  millisTill6,
  millisTill12pm,
  millisTill6pm
);
setTimeout(() => {
  cycle();
  setInterval(cycle, 86400000);
}, millisTillBackup);

function getBackupSlots(serverId) {
  let serverFolder = fs.readdirSync(`./backups/${serverId}`);
  let backupSlots = [];
  for (let i = 0; i < serverFolder.length; i++) {
    backupSlots.push({
      id: serverFolder[i],
      timestamp: new Date(parseInt(serverFolder[i].split(".")[0])),
      size: fs.statSync(`./backups/${serverId}/${serverFolder[i]}`).size,
    });
  }
  backupSlots.sort((a, b) => {
    return a.timestamp - b.timestamp;
  });
  return backupSlots;
}

module.exports = { getBackupSlots };
