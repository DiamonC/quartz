const { createHash, scryptSync, randomBytes } = require("crypto");

const fs = require("fs");

function download(file, url) {
  exec(`curl -o ${file} -LO "${url}"`);
}

function downloadAsync(file, url, callback) {
  //formats url
  url = url.replace(/ /g, "%20");
  url = url.replace(/\[/g, "%5B");
  url = url.replace(/\]/g, "%5D");

  exec(`curl -sS -o ${file} -L "${url}" > /dev/null`, (error, stdout, stderr) => {
    try {
      let out = "";
      if (stdout != undefined) {
        out = stdout;
      }
      callback(out);
    } catch (e) {
      console.log("Error in callback whislst downloading " + file);
      console.log("Error: " + e);
      console.log("stdout: " + stdout);
      console.log("stderr: " + stderr);
    }
  });
}

function extract(archive, dir) {
  exec(`tar -xvf ${archive} -C ${dir}`);
}

function extractAsync(archive, dir, callback) {
  exec(`tar -xvf ${archive} -C ${dir}`, (error, stdout, stderr) => {
    callback(stdout);
  });
}

function hash(input, salt) {
  if (salt == undefined) {
    salt = randomBytes(12).toString("hex");
  }

  return salt + ":" + scryptSync(input, salt, 48).toString("hex");
}

function hashNoSalt(input) {
  const config = require("./utils.js").getConfig();
  return scryptSync(input, config.pepper, 48).toString("hex");
}

function folderSizeRecursive(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    console.log(`Directory "${directoryPath}" does not exist.`);
    return;
  }

  let bytes = 0;
  const files = fs.readdirSync(directoryPath);
  files.forEach((file) => {
    const curPath = `${directoryPath}/${file}`;

    if (fs.lstatSync(curPath).isDirectory()) {
      bytes += folderSizeRecursive(curPath);
    } else {
      bytes += fs.statSync(curPath).size;
    }
  });
  return bytes;
}


function readFilesRecursive(directoryPath) {
  // normalize the incoming path once
  directoryPath = directoryPath.replace(/\/\//g, '/');

  if (!fs.existsSync(directoryPath)) {
    console.log(`Directory "${directoryPath}" does not exist.`);
    return [];
  }

  const result = [];
  const entries = fs.readdirSync(directoryPath);

  for (const entry of entries) {
    if (entry.startsWith('.')) continue;           // skip hidden
    const curPath = path.join(directoryPath, entry)
                        .replace(/\/\//g, '/');

    const isDir = fs.lstatSync(curPath).isDirectory();
    if (isDir) {
      // 1) Recurse
      const subTree = readFilesRecursive(curPath);

      // 2) Sum sizes in subtree
      let totalSize = 0;
      const accumulate = (node) => {
        if (typeof node === 'string') {
          // "name:path:size"
          const parts = node.split(':');
          totalSize += Number(parts[2]) || 0;
        } else if (Array.isArray(node)) {
          // [ "name:path:size", [ ... ] ]
          const [dirDescriptor, children] = node;
          const sizePart = Number(dirDescriptor.split(':')[2]) || 0;
          totalSize += sizePart;
          children.forEach(accumulate);
        }
      };
      subTree.forEach(accumulate);

      // 3) Build descriptor with summed size
      const dirDescriptor = `${entry}:${curPath}:${totalSize}`;
      result.push([dirDescriptor, subTree]);

    } else {
      // file: just stat its size
      let size = 0;
      try {
        size = fs.statSync(curPath).size;
      } catch (err) {
        console.warn(`Could not stat "${curPath}":`, err);
      }
      result.push(`${entry}:${curPath}:${size}`);
    }
  }

  return result;
}


const { execSync, exec } = require("child_process");
const path = require("path");

function removeDirectoryRecursive(directoryPath) {
  try {
    // Normalize path
    const normalizedPath = path.normalize(directoryPath);

    // Check if the directory exists
    try {
      fs.statSync(normalizedPath);
    } catch {
      console.log(`Directory "${normalizedPath}" does not exist.`);
      return;
    }

    // Check if the directory is within "servers"
    if (normalizedPath.includes("servers")) {
      execSync(`rm -rf ${normalizedPath}/*`); // Removes contents but keeps folder
    } else {
      execSync(`rm -rf ${normalizedPath}`); // Removes folder entirely
    }

    console.log(`Successfully cleaned: ${normalizedPath}`);
  } catch (error) {
    console.error(`Error removing directory: ${error.message}`);
  }
}

function removeDirectoryRecursiveAsync(directoryPath, callback) {
  try {
    const normalizedPath = path.normalize(directoryPath);

    // Check if directory exists
    fs.stat(normalizedPath, (err, stats) => {
      if (err) {
        console.log(`Directory "${normalizedPath}" does not exist.`);
        return callback(`Directory "${normalizedPath}" does not exist.`);
      }

      // Check if the directory is inside "servers"
      if (normalizedPath.includes("servers")) {
        exec(`rm -rf ${normalizedPath}/*`, (error, stdout, stderr) => {
          if (error) {
            console.error(`Error removing directory contents: ${stderr}`);
            return callback(stderr);
          }
          console.log(`Successfully cleaned: ${normalizedPath}`);
          callback(stdout);
        });
      } else {
        exec(`rm -rf ${normalizedPath}`, (error, stdout, stderr) => {
          if (error) {
            console.error(`Error removing directory: ${stderr}`);
            return callback(stderr);
          }
          console.log(`Successfully removed: ${normalizedPath}`);
          callback(stdout);
        });
      }
    });
  } catch (error) {
    console.error(`Error: ${error.message}`);
    callback(error.message);
  }
}

function getIPID(ip) {
  const config = require("./utils.js").getConfig();
  return hash(ip, config.pepper).split(":")[1];
}

function write(file, content) {
  const fs = require("fs");
  const oldFile = fs.readFileSync(file, "utf8");
  fs.writeFileSync(`backup/${file}`, oldFile);

  fs.writeFileSync(file, content);
}

function GET(url, callback) {
  exec(`curl ` + url, (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      return;
    }
    callback(stdout);
  });
}

function simplifyTerminal(terminal, software) {
  let terminalLines;
  if (terminal == undefined) {
    return "";
  } else {
    terminalLines = terminal.split("\n[");
  }

  for (let i = terminalLines.length - 1; i >= 0; i--) {
    let line = terminalLines[i];
    switch (true) {
      case line.includes("is missing mods.toml"):
        terminalLines.splice(i, 1);
        break;
      case line.includes("Incorrect Key"):
        terminalLines.splice(i, 1);
        break;
      case line.includes("union:/"):
        terminalLines.splice(i, 1);
        break;
      case line.includes("mojang/Yggdrasil"):
        terminalLines.splice(i, 1);
        break;
      case line.includes("This server is running"):
        terminalLines.splice(i, 1);
        break;
      case line.includes("SERVER IS RUNNING IN OFFLINE"):
        terminalLines.splice(i, 1);
        terminalLines.splice(i, 1);
        terminalLines.splice(i, 1);
        terminalLines.splice(i, 1);
        terminalLines.splice(i, 1);
        break;
      case line.includes("Couldn't load server icon"):
        terminalLines[i] =
          terminalLines[i].split("]: ")[0] +
          "]: Couldn't load server icon. It may be too large.";
        break;
      case line.includes("Paper: Using"):
        terminalLines.splice(i, 1);
        terminalLines.splice(i, 1);
        break;
      case line.includes("Server permissions file"):
        terminalLines.splice(i, 1);
        break;
      case line.includes("There's a new Geyser update available"):
        terminalLines[i] =
          line.split("]: ")[0] +
          "]: Geyser has an update available. It will arrive in our database within 12 hours if it hasn't already. Restart to apply it.";
        break;
      case line.includes("The timings profiler"):
        terminalLines.splice(i, 1);
        break;
      case line.includes("***********"):
        terminalLines.splice(i, 1);
        break;
      case line.includes("java.base/jdk.internal.reflect"):
        terminalLines.splice(i, 1);
        terminalLines.splice(i, 1);
        break;
      case line == "[to be removed":
        terminalLines.splice(i, 1);
        break;
      case line.includes("Loaded plugin geyser"):
        terminalLines[i] = line.split("]: ")[0] + "]: Launching Geyser";
        break;
      case line.includes("Loading Geyser version"):
        terminalLines[i] = line.split("]: ")[0] + "]: Loading Geyser";
        terminalLines.splice(i - 1, 1);
        terminalLines.splice(i, 1);
        terminalLines.splice(i, 1);
        break;
    }
  }
  if (terminalLines[0] != "" && software != "velocity") {
    if (!terminalLines[0].includes("[")) {
      return "[" + terminalLines.join("\n[");
    } else {
      return terminalLines.join("\n[");
    }
  }

  return terminalLines.join("\n[");
}

function getIndex(callback) {
  let index = {};
  exec("ls -1 data | sort -r -V", (error, stdout, stderr) => {
    // Split the sorted file names into an array
    const sortedFiles = stdout.trim().split("\n");
    // Process the sorted files
    sortedFiles.forEach((file) => {
      switch (file) {
        case "cx_geyser-velocity_Geyser.jar":
          file = "geyser-velocity.jar";
          break;
        case "cx_geyser-spigot_Geyser.jar":
          file = "geyser-spigot.jar";
          break;
        case "cx_floodgate-velocity_Floodgate.jar":
          file = "floodgate-velocity.jar";
          break;
        case "cx_floodgate-spigot_Floodgate.jar":
          file = "floodgate-spigot.jar";
          break;
      }

      if (file.includes("-")) {
        let software = file.split("-")[0];
        let version = "";
        if (file.includes(".jar")) {
          console.log(file);
          version = file.split("-")[1].split(".jar")[0];
        } else {
          version = file.split("-")[1].split(".zip")[0];
        }
        if (index[software] == undefined) {
          index[software] = [];
        }
        let date;
        if (fs.existsSync("./assets/jars/" + file)) {
          date = fs.statSync("./assets/jars/" + file).mtime;
        }
        index[software].push({
          version: version,
          link: `jars/${software}/${version}`,
          date: date,
          software: software,
        });
      }
    });
    callback(index);
  });
}
module.exports = {
  hash,
  hashNoSalt,
  download,
  extract,
  extractAsync,
  write,
  GET,
  getIPID,
  removeDirectoryRecursive,
  downloadAsync,
  removeDirectoryRecursiveAsync,
  readFilesRecursive,
  simplifyTerminal,
  folderSizeRecursive,
  getIndex,
};
