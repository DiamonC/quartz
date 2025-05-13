var events = require("events");
var eventEmitter = new events.EventEmitter();
fs = require("fs");
let states = [];
const files = require("./files.js");
const config = require("./utils.js").getConfig();
const utils = require("./utils.js");
const readJSON = require("./utils.js").readJSON;
const { time, Console } = require("console");
const { randomBytes } = require("crypto");
const { stat } = require("fs");
const writeJSON = require("./utils.js").writeJSON;
let terminalOutput = [];
let terminalInput = "";

const portOffset = 10000; 

let amountOfThreads = 16;

const {execSync} = require("child_process");
try {
let amountOfCores = parseInt(execSync(`lscpu | grep "^Core(s) per socket" | awk '{print $4}'`));
let threadsPerCore = parseInt(execSync(`lscpu | grep "^Thread(s) per core" | awk '{print $4}'`));
amountOfThreads = amountOfCores * threadsPerCore;
} catch (e) {
  console.log("error getting amount of threads: " + e);
}


let threads = [];

for (let i = 0; i < amountOfThreads; i++) {
  threads.push(i);
}

console.log("threads: " + threads);
let serversOnThreads = [];

setInterval(() => {
  console.log(serversOnThreads);
}, 1000* 60 * 5);

function getServersOnThreads() {
  return serversOnThreads;
}
        
function proxiesToggle(id, toggle, secret) {
  if (toggle == true) {
    let paperGlobal = fs.readFileSync(
      `servers/${id}/config/paper-global.yml`,
      "utf8"
    );

    //set the line after 'velocity:' to 'enabled: true'
    let paperGlobalLines = paperGlobal.split("\n");
    let secretIndex = paperGlobalLines.findIndex((line) => {
      return line.includes("    secret:");
    });
    paperGlobalLines[secretIndex] = "    secret: " + secret;
    let index = paperGlobalLines.indexOf("  velocity:");
    paperGlobalLines[index + 1] = "    enabled: true";

    paperGlobal = paperGlobalLines.join("\n");

    fs.writeFileSync(`servers/${id}/config/paper-global.yml`, paperGlobal);

    let serverProperties = fs.readFileSync(
      `servers/${id}/server.properties`,
      "utf8"
    );

    serverProperties = serverProperties.replace(
      /online-mode=true/g,
      `online-mode=false`
    );

    fs.writeFileSync(`servers/${id}/server.properties`, serverProperties);
  } else {
    let paperGlobal = fs.readFileSync(
      `servers/${id}/config/paper-global.yml`,
      "utf8"
    );

    let index = paperGlobal.split("\n").indexOf("secret: ");
    let paperGlobalLines = paperGlobal.split("\n");

    paperGlobalLines[index] == "    secret: " + secret;

    //set the line after 'velocity:' to 'enabled: false'
    let index2 = paperGlobalLines.indexOf("  velocity:");
    paperGlobalLines[index2 + 1] = "    enabled: false";
    paperGlobal = paperGlobalLines.join("\n");

    fs.writeFileSync(`servers/${id}/config/paper-global.yml`, paperGlobal);

    let serverProperties = fs.readFileSync(
      `servers/${id}/server.properties`,
      "utf8"
    );

    serverProperties = serverProperties.replace(
      /online-mode=false/g,
      `online-mode=true`
    );

    fs.writeFileSync(`servers/${id}/server.properties`, serverProperties);
  }
}

function getState(id) {
  if (states[id] == undefined) {
    states[id] = "false";
    console.log("setting status of " + id + " to false on line #1");
  }
  return states[id];
}
function checkServer(id) {
  if (states[id] == undefined) {
    states[id] = "false";
    console.log("setting status of " + id + " to false on line #2");
  }
  let server = readJSON("servers/" + id + "/server.json");
  return {
    version: server.version,
    software: server.software,
    specialDatapacks: server.specialDatapacks,
    specialPlugins: server.specialPlugins,
    state: states[id],
  };
}
function run(
  id,
  software,
  version,
  addons,
  cmd,
  em,
  isNew,
  modpackURL,
  modpackID,
  modpackVersionID
) {
  try {
    if (version != undefined && version.includes(" ")) {
      version = version.split(" ").join("*");
    }
    const { exec, execSync, spawn } = require("child_process");
    //this looks for servers running on the same port that may obstruct startup
    killObstructingProcess(parseInt(id));

    if (fs.existsSync("servers/" + id + "/world/session.lock")) {
      fs.unlinkSync("servers/" + id + "/world/session.lock");
    }
    if (fs.existsSync("servers/" + id + "/world_nether/session.lock")) {
      fs.unlinkSync("servers/" + id + "/world_nether/session.lock");
    }
    if (fs.existsSync("servers/" + id + "/world_the_end/session.lock")) {
      fs.unlinkSync("servers/" + id + "/world_the_end/session.lock");
    }

    let server = readJSON("servers/" + id + "/server.json");
    let out = [];
    states[id] = "starting";

    // i isNew is undefined, set it to true
    if (isNew == undefined) {
      isNew = true;
    }

    //make sure isNew is a boolean
    isNew = Boolean(isNew);

    if (isNew === false) {
      software = server.software;
      version = server.version;
      addons = server.addons;
    }

    for (i in cmd) {
      if (cmd[i] != undefined) {
        cmd[i] = cmd[i].toLowerCase();
      }
    }

    let folder = "servers/" + id;
    if (software == "quilt") {
      folder = "servers/" + id + "/server";
      if (!fs.existsSync(folder)) {
        try {
          fs.mkdirSync(folder);
        } catch {
          console.log("error creating server folder");
        }
      }
    }
    let allocatedRAM;
    if (config.basic == server.productID) {
      allocatedRAM = 4;
    } else if (config.plus == server.productID) {
      allocatedRAM = 6;
    } else if (config.premium == server.productID) {
      allocatedRAM = 8;
    } else if (config.max == server.productID) {
      allocatedRAM = 12;
    }else {
      allocatedRAM = 4;
    }
    let args = [
      "-Xmx" +
        allocatedRAM +
        "G -XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=8M -XX:G1ReservePercent=20 -XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 -XX:InitiatingHeapOccupancyPercent=15 -XX:G1MixedGCLiveThresholdPercent=90 -XX:G1RSetUpdatingPauseTimePercent=5 -XX:SurvivorRatio=32 -XX:+PerfDisableSharedMem -XX:MaxTenuringThreshold=1 -Daikars.new.flags=true -Dusing.aikars.flags=https://mcflags.emc.gs -jar server.jar",
    ];
    //make a new folder called name using fs
    let s = "paper";
    let c = "servers";
    let installer = false;

    fs.writeFileSync(folder + "/eula.txt", "eula=true");

    //make software all lowercase
    software = software.toLowerCase();
    console.log("SOFTWARE: " + software);
    switch (software) {
      case "paper":
        s = "paper";
        c = "servers";
        break;
      case "velocity":
        s = "velocity";
        c = "proxies";
        break;
      case "quilt":
        s = "fabric";
        c = "modded";
        installer = true;
        break;
      case "vanilla":
        s = "vanilla";
        c = "vanilla";
        break;
      case "waterfall":
        s = "waterfall";
        c = "proxies";
        break;
      case "forge":
        s = "forge";
        c = "modded";
        installer = true;
        break;
      case "neoforge":
        s = "neoforge";
        c = "modded";
        installer = true;
        break;
      case "fabric":
        s = "fabric";
        c = "modded";

        break;
      case "snapshot":
        s = "snapshot";
        c = "vanilla";
        break;
      case "spigot":
        s = "spigot";
        c = "servers";
        break;
    }
    let javaVer = "8";
    //this selects the correct version of java for the minecraft version
    if (parseInt(version.split(".")[1]) >= 20) javaVer = "21";
    else if (version.includes("1.19")) javaVer = "21";
    else if (version.includes("1.18")) javaVer = "17";
    else if (version.includes("1.17")) javaVer = "17";
    if (software == "velocity") javaVer = "17";

    if (software == "snapshot") {
      javaVer = "21";
    }
    let absolutePath = execSync("pwd").toString().trim();
    console.log("absolutePath: " + absolutePath);

    if (software == "quilt") {
      absolutePath = absolutePath + "/servers/" + id;
    }

    let port = portOffset + parseInt(id);
    let thread1 = threads[0]
    let thread2 = threads[1]; 
    let thread3 = threads[2];
    let thread4 = threads[3];
    //removes those threads from the array
    threads.splice(0, 3);
    
    //adds those threads to the end of the array
    threads.push(thread1);
    threads.push(thread2);
    threads.push(thread3);
    threads.push(thread4);

    let threadsString = thread1 + "," + thread2 + "," + thread3 + "," + thread4;

    //clear any existing items with the same id
    for (let i = 0; i < serversOnThreads.length; i++) {
      if (serversOnThreads[i].id == id) {
        serversOnThreads.splice(i, 1);
        break;
      }
    }


    serversOnThreads.push({id: id, threads: threadsString});


    //the .1 is to let java have some extra room to prevent crashes
    let prefix = `docker run -m ${allocatedRAM}.1g -i -v ${absolutePath}/servers/${id}:/server -w /server -p ${port}:${port}/tcp -p ${port}:${port}/udp -p ${port + 66}:${port + 66}/tcp -p ${port + 33}:${port + 33}/udp --user 1000:1000 --cpuset-cpus="${threadsString}" openjdk:${javaVer} java`;
    console.log("prefix: " + prefix);

    let doneInstallingServer = false;

    if (!fs.existsSync(folder)) {
      try {
        fs.mkdirSync(folder);
      } catch {
        console.log("error creating server folder");
      }
      //fs.writeFileSync(folder + "/world.zip", worldFile);
    }
    if (!fs.existsSync(folder + "/plugins")) {
      fs.mkdirSync(folder + "/plugins");
    }
    if (!fs.existsSync(folder + "/mods/")) {
      fs.mkdirSync(folder + "/mods/");
    }
    if (!fs.existsSync(folder + "/.fileVersions")) {
      fs.mkdirSync(folder + "/.fileVersions");
    }
    let libraryline = "/libraries/net/minecraftforge/forge/";
    if (software == "neoforge") {
      libraryline = "/libraries/net/neoforged/neoforge/";
    }

    if (software != "quilt") {
      console.log("moving " + software + "-" + version + ".jar to " + folder);
      if (fs.existsSync("assets/jars/" + software + "-" + version + ".jar")) {
        fs.copyFileSync(
          "assets/jars/" + software + "-" + version + ".jar",
          folder + "/server.jar"
        );
      }
    } else {
      fs.copyFileSync(
        "assets/jars/" + software + "-0.5.1.jar",
        "servers/" + id + "/server.jar"
      );
      args = [
        "-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=8M -XX:G1ReservePercent=20 -XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 -XX:InitiatingHeapOccupancyPercent=15 -XX:G1MixedGCLiveThresholdPercent=90 -XX:G1RSetUpdatingPauseTimePercent=5 -XX:SurvivorRatio=32 -XX:+PerfDisableSharedMem -XX:MaxTenuringThreshold=1 -Daikars.new.flags=true -Dusing.aikars.flags=https://mcflags.emc.gs -jar server.jar install server " +
          version +
          " --download-server",
      ];
    }

    //run code for each item in addons
    //mkdir folder/world/datapacks
    // if world folder doesnt exist
    if (!fs.existsSync(folder + "/world/datapacks")) {
      if (!fs.existsSync(folder + "/world")) {
        fs.mkdirSync(folder + "/world");
      }
      fs.mkdirSync(folder + "/world/datapacks");
    }
    
    for (i in addons) {
      let lowercase;
      let uppercase;
      let lrId;
      if (addons[i] == "terralith") {
         lowercase = "terralith";
         uppercase = "Terralith";
         lrId = "8oi3bsk5";
      }
      if (addons[i] == "incendium") {
         lowercase = "incendium";
         uppercase = "Incendium";
         lrId = "ZVzW5oNS";
      }
      if (addons[i] == "nullscape") {
         lowercase = "nullscape";
         uppercase = "Nullscape";
         lrId = "LPjGiSO4";
      }
      if (addons[i] == "structory") {
         lowercase = "structory";
         uppercase = "Structory";
         lrId = "aKCwCJlY";
      }

        if (fs.existsSync("assets/jars/"+lowercase+"-" + version.split("*")[0] + ".zip")) {
        fs.copyFileSync(
          "assets/jars/"+lowercase+"-" + version.split("*")[0] + ".zip",
          folder + "/world/datapacks/lr_"+lrId+"_"+uppercase+".zip"
        );
      } else if (fs.existsSync("assets/jars/"+lowercase+"-" + version.split("*")[0] + "*beta.zip")) {
        fs.copyFileSync(
          "assets/jars/"+lowercase+"-" + version.split("*")[0] + "*beta.zip",
          folder + "/world/datapacks/lr_"+lrId+"_"+uppercase+".zip"
        );  
      } else if (fs.existsSync("assets/jars/"+lowercase+"-" + version.split("*")[0] + "*alpha.zip")) {

        fs.copyFileSync(
          "assets/jars/"+lowercase+"-" + version.split("*")[0] + "*alpha.zip",
          folder + "/world/datapacks/lr_"+lrId+"_"+uppercase+".zip"
        );  
      }

      
    }

    let data;
    if (software == "velocity") {
      if (isNew) {
        data = fs.readFileSync("assets/template/velocity.toml", "utf8");
      } else {
        data = fs.readFileSync("servers/" + id + "/velocity.toml", "utf8");
      }
      let result;
      if (server.adminServer) {
        result = data.replace(
          /player-info-forwarding-mode = "NONE"/g,
          `player-info-forwarding-mode = "modern"`
        );
      } else {
        result = data
          .replace(/bind = "0.0.0.0:25577"/g, `bind = "0.0.0.0:${port}"`)
          .replace(
            /player-info-forwarding-mode = "NONE"/g,
            `player-info-forwarding-mode = "modern"`
          );
      }

      fs.writeFileSync(folder + "/velocity.toml", result, "utf8");

      if (!fs.existsSync(folder + "/forwarding.secret")) {
        let secret = randomBytes(12).toString("hex");
        fs.writeFileSync(folder + "/forwarding.secret", secret, "utf8");
      }
    } else {
      if (isNew) {
        data = fs.readFileSync("assets/template/server.properties", "utf8");
        data = data.replace(/spawn-protection=16/g, `spawn-protection=0`);
        if (software == "paper") {
          let paperGlobal = fs.readFileSync(
            "assets/template/paper-global.yml",
            "utf8"
          );
          if (!fs.existsSync(folder + "/config")) {
            fs.mkdirSync(folder + "/config");
          }
          fs.writeFileSync(
            folder + "/config/paper-global.yml",
            paperGlobal,
            "utf8"
          );
        }
      } else {
        data = fs.readFileSync(folder + "/server.properties", "utf8");
      }
      let result = data;
      if (!server.adminServer) {
        //find the server-port line 
        let a = result.split("\n").findIndex((line) => {
          return line.includes("server-port");
        });
        //replace the line with the new port
        let resultssplit = result.split("\n");
        resultssplit[a] = "server-port=" + port;
        result = resultssplit.join("\n");
        

      }

      fs.writeFileSync(folder + "/server.properties", result, "utf8");
    }

    //special plugin operations
    //if a plugin has a jar but not a folder, we know that
    //it hasnt been installed yet and the config needs to modified
    let plugins = fs.readdirSync(folder + "/plugins");


    utils.writeJSON("servers/" + id + "/server.json", server);

    for (i in plugins) {
      let isJar = plugins[i].includes(".jar");
      if (isJar) {
        if (plugins[i].includes("Dynmap")) {
          let interval1 = setInterval(() => {
            if (fs.existsSync(folder + "/plugins/dynmap/configuration.txt")) {
              let data = fs.readFileSync(
                folder + "/plugins/dynmap/configuration.txt",
                "utf8"
              );

              let lines = data.split("\n");

              let a = lines.findIndex((line) => {
                return line.includes("webserver-port");
              });

              lines[a] = "webserver-port: " + (port + 66);

              let b = lines.findIndex((line) => {
                return line.includes("deftemplatesuffix");
              });

              lines[b] = "deftemplatesuffix: vlowres";

              let c = lines.findIndex((line) => {
                return line.includes("image-format");
              });

              lines[c] = "image-format: jpg";

              fs.writeFileSync(
                folder + "/plugins/dynmap/configuration.txt",
                lines.join("\n"),

                "utf8"
              );

              if (!server.specialPlugins.includes("dynmap")) {
                server.specialPlugins.push("dynmap");
              }
              utils.writeJSON("servers/" + id + "/server.json", server);
              let interval2 = setInterval(() => {
                if (getState(id) == "true") {
                  writeTerminal(id, "dynmap fullrender world");
                  clearInterval(interval2);
                }
              }, 3000);
              clearInterval(interval1);
            }
          }, 10);
        } else {
          if (server.specialPlugins != undefined) {
            if (server.specialPlugins.includes("dynmap")) {
              server.specialPlugins.splice(
                server.specialPlugins.indexOf("dynmap"),
                1
              );
              utils.writeJSON("servers/" + id + "/server.json", server);
            }
          }
        }

        if (plugins[i].includes("BlueMap")) {
          //change accept-download to true in BlueMap/core.conf
          let interval1 = setInterval(() => {
            if (fs.existsSync(folder + "/plugins/BlueMap/core.conf")) {
              let data = fs.readFileSync(
                folder + "/plugins/BlueMap/core.conf",
                "utf8"

              );
             
              let lines = data.split("\n");
              let a = lines.findIndex((line) => {
                return line.includes("accept-download:");
              } 
);
              lines[a] = "accept-download: true";

              fs.writeFileSync(
                folder + "/plugins/BlueMap/core.conf",
                lines.join("\n"),

                "utf8"
              );

              //change the port in BlueMap/webserver.conf to port + 66
              if (fs.existsSync(folder + "/plugins/BlueMap/webserver.conf")) {
                let data2 = fs.readFileSync(
                  folder + "/plugins/BlueMap/webserver.conf",
                  "utf8"
                );
                let lines2 = data2.split("\n");
                let b = lines2.findIndex((line) => {
                  return line.includes("port:");
                });
                let configuredAlready = !lines2[b].includes("8100");
                lines2[b] = "port: " + (port + 66);
                fs.writeFileSync(
  
  
                  folder + "/plugins/BlueMap/webserver.conf",
                  lines2.join("\n"),
                  "utf8"
                );
                if (!server.specialPlugins.includes("bluemap")) { 
                  server.specialPlugins.push("bluemap");
                }
                utils.writeJSON("servers/" + id + "/server.json", server);
                if (!configuredAlready) {
                  writeTerminal(id, "say [Arth Panel] BlueMap has been configured. Please restart the server to start using it.");
                  
                }
                clearInterval(interval1);
              }
            }
          }, 10);
        } else {
          if (server.specialPlugins != undefined) {
          if (server.specialPlugins.includes("bluemap")) {
            server.specialPlugins.splice(
              server.specialPlugins.indexOf("bluemap"),
              1
            );
            utils.writeJSON("servers/" + id + "/server.json", server);
          }
        }
        }

        if (plugins[i].includes("Simple-Voice-Chat")) {
          let interval1 = setInterval(() => {
            if (
              fs.existsSync(
                folder + "/plugins/voicechat/voicechat-server.properties"
              )
            ) {
              let data = fs.readFileSync(
                folder + "/plugins/voicechat/voicechat-server.properties",
                "utf8"
              );

              let lines = data.split("\n");

              let a = lines.findIndex((line) => {
                return line.includes("port=");
              });

              lines[a] = "port=" + (port + 33);

              fs.writeFileSync(
                folder + "/plugins/voicechat/voicechat-server.properties",
                lines.join("\n"),

                "utf8"
              );
              if (!server.specialPlugins.includes("voicechat")) {
                server.specialPlugins.push("voicechat");
              }
              utils.writeJSON("servers/" + id + "/server.json", server);

              clearInterval(interval1);
            }
          }, 10);
        } else {
          if (server.specialPlugins != undefined) {
          if (server.specialPlugins.includes("voicechat")) {
            server.specialPlugins.splice(
              server.specialPlugins.indexOf("voicechat"),
              1
            );
            utils.writeJSON("servers/" + id + "/server.json", server);
          }
        }
        }

        if (plugins[i].includes("DiscordSRV")) {
          if (!server.specialPlugins.includes("discordsrv")) {
            server.specialPlugins.push("discordsrv");
          }
          utils.writeJSON("servers/" + id + "/server.json", server);
        } else {
          if (server.specialPlugins != undefined) {
          if (server.specialPlugins.includes("discordsrv")) {
            server.specialPlugins.splice(
              server.specialPlugins.indexOf("discordsrv"),
              1
            );
            utils.writeJSON("servers/" + id + "/server.json", server);
          }
        }
        }

        if (plugins[i].includes("Chunky")) {
          if (!server.specialPlugins.includes("chunky")) {
            server.specialPlugins.push("chunky");
          }
          utils.writeJSON("servers/" + id + "/server.json", server);
        } else {
          if (server.specialPlugins != undefined) {
          if (server.specialPlugins.includes("chunky")) {
            server.specialPlugins.splice(
              server.specialPlugins.indexOf("chunky"),
              1
            );
            utils.writeJSON("servers/" + id + "/server.json", server);
          }
        }
        }
      }
    }
    //copy /assets/template/Geyser-Spigot.jar to folder/plugins

    let ls;
    let interval = 0;
    if (c == "modded" && isNew) {
      if (modpackURL != undefined) {
        downloadModpack(id, modpackURL, modpackID, modpackVersionID);
      }
    }
    if (installer) {
      if (isNew) {
        interval = 500;
        states[id] = "installing";
        //previous terminals should be cleared
        //so give extra feedback the server is installing
        terminalOutput[id] =
          "[System] Installing " +
          software.charAt(0).toUpperCase() +
          software.slice(1) +
          "...";

        if (software == "forge") {
          exec(
            prefix + " -jar server.jar --installServer",
            { cwd: folder, stdio: "inherit" },
            (err, out) => {
              if (err == null || !err.toString().includes("Command failed")) {
                doneInstallingServer = true;
              } else if (
                out
                  .toString()
                  .includes("authserver.mojang.com: Name or service not known")
              ) {
                terminalOutput[id] =
                  "Error]: Minecraft's auth servers are down. Try again later.";
                states[id] = "false";
              }
            }
          );
        } else {
          //quilt
          exec(
            prefix + " " + args,
            { cwd: "servers/" + id, stdio: "inherit" },
            (error, stdout, stderr) => {
              console.log(error);
              console.log(stdout);
              console.log(stderr);
              doneInstallingServer = true;
            }
          );
        }
      } else if (
        fs.existsSync(folder +libraryline)
      ) {
        doneInstallingServer = true;
      } else {
        console.log("exists: "+folder  +libraryline);
        states[id] = "false";
        terminalOutput[id] = "[Error]: Forge failed to install.";
      }
      let timeToLoad = true;

      //wait for forge to install
      setInterval(() => {
        if (doneInstallingServer && timeToLoad) {
          timeToLoad = false;
          states[id] = "starting";

          let args =
            "-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=8M -XX:G1ReservePercent=20 -XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 -XX:InitiatingHeapOccupancyPercent=15 -XX:G1MixedGCLiveThresholdPercent=90 -XX:G1RSetUpdatingPauseTimePercent=5 -XX:SurvivorRatio=32 -XX:+PerfDisableSharedMem -XX:MaxTenuringThreshold=1 -Daikars.new.flags=true -Dusing.aikars.flags=https://mcflags.emc.gs";
          //-Dlog4j.configurationFile=consoleconfig.xml
          //get the forge version from the name of the folder inside /libraries/net/minecraftforge/forge/

          let execLine = "";
          let cwd = folder;

          if (software == "forge" || software == "neoforge") {
            let forgeVersion;

            if (fs.existsSync(folder +libraryline)) {
              forgeVersion = fs.readdirSync(
                folder + libraryline
              )[0];
            }

            execLine =
              prefix +
              ` @user_jvm_args.txt @${libraryline.substring(1)}${forgeVersion}/unix_args.txt "$@"`;
            
               //allocate ram to user_jvm_args.txt
               if (fs.existsSync
                (folder + "/user_jvm_args.txt")) {
                  let data = fs.readFileSync(
                    folder + "/user_jvm_args.txt",
                    "utf8"  
                  );
                  let lines = data.split("\n");
                  let a = lines.findIndex((line) => {
                    return line.includes("-Xmx");
                  }   
                  );
                  lines[a] = "-Xmx" + allocatedRAM + "G";
                  fs.writeFileSync(
                    folder + "/user_jvm_args.txt",
                    lines.join("\n"),
                    "utf8"
                  );
                }
              
            if (software == "forge") {
              if (parseInt(version.split(".")[1]) >= 21) {
                execLine = prefix + ` -jar forge-${forgeVersion}-shim.jar`;
              }
  
              if (version.includes("1.16")) {
                execLine = prefix + ` -jar forge-${forgeVersion}.jar`;
              }
  
              if (version.includes("1.12")) {
                execLine = prefix + ` ${args} -jar forge-${forgeVersion}.jar`;
              }
  
              if (parseInt(version.split(".")[1]) <= 8) {
                let jarname = "";
                fs.readdirSync(folder).forEach((file) => {
                  if (file.includes("-universal.jar")) {
                    jarname = file;
                  }
                });
                execLine = prefix + ` -jar ${jarname}`;
              }
            } else {
              execLine = prefix + ` @user_jvm_args.txt @libraries/net/neoforged/neoforge/${forgeVersion}/unix_args.txt "$@"`;
            }

   
          } else {
       
            execLine = prefix + ` @user_jvm_args.txt @libraries/net/neoforged/neoforge/21.1.122/unix_args.txt "$@"`;
            //?
          }
          console.log("exec line: "+execLine);
          let timestamp = new Date().toLocaleTimeString();
          console.log(timestamp + " :t starting server " + id + " with:\n" + execLine);
          ls = spawn(
            execLine,
            { cwd: cwd, stdio: ["pipe", "pipe", "pipe"], shell: true },
            (error, stdout, stderr) => {
              terminalOutput[id] = stdout;
              states[id] = "false";
              console.log("setting status of " + id + " to false on line #3");
            }
          );

          ls.stdout.on("data", (data) => {
            count++;
            if (count >= 3) {
              out.push(data);
            }

            terminalOutput[id] = out.join("\n");
            if (
              terminalOutput[id].includes("Done (") &&
              states[id] != "stopping"
            ) {
              //replace states[id] with true
              states[id] = "true";
            } else if (
              terminalOutput[id].includes(
                "Failed to start the minecraft server"
              )
            ) {
              states[id] = "false";
              console.log("setting status of " + id + " to false on line #4");

              killObstructingProcess(parseInt(id));
              ls.kill();
            }
          });
          let count2 = 0;
          let intervalID = setInterval(() => {
            if (states[id] == "stopping") {
              console.log("stopping " + count2);
              if (count2 < 5 * 24) {
                ls.stdin.write("stop\n");
                count2++;
              } else {
                states[id] = "false";
                console.log("setting status of " + id + " to false on line #5");

                killObstructingProcess(parseInt(id));
                ls.kill();
                clearInterval(intervalID);
              }
            }
          }, 200);
          eventEmitter.on("writeCmd:" + id, function () {
            ls.stdin.write(terminalInput + "\n");
          });
          ls.on("exit", () => {
            states[id] = "false";
            console.log("setting status of " + id + " to false on line #7");
            terminalOutput[id] = out.join("\n");
            clearInterval(intervalID);
          });
        }
      }, interval);
    } else {
      let count = 0;
      let timestamp = new Date().toLocaleTimeString();
      console.log(timestamp + " :t starting server " + id + " with:\n" + prefix + " " + args);
      ls = spawn(
        prefix + " " + args,
        { cwd: folder, stdio: ["pipe", "pipe", "pipe"], shell: true },
        (error, stdout, stderr) => {
          if (states[id] != "false") terminalOutput[id] = stdout;
          states[id] = "false";
          console.log(error, stderr);
          console.log("setting status of " + id + " to false on line #8");
        }
      );
      ls.stdout.on("data", (data) => {
        count++;
        if (count >= 3) {
          out.push(data);
        }

        terminalOutput[id] = out.join("\n");
        if (terminalOutput[id].includes("Done (") && states[id] != "stopping") {
          //replace states[id] with true
          states[id] = "true";
        } else if (
          terminalOutput[id].includes("Failed to start the minecraft server")
        ) {
          states[id] = "false";
          console.log("setting status of " + id + " to false on line #9");

          killObstructingProcess(parseInt(id));
          ls.kill();
        }
      });
ls.stderr.on("data", data => {
  const text = data.toString("utf8");
    if (states[id] != "false") { terminalOutput[id] = "[Crash]: " + text;
      console.log(terminalOutput[id]);}
    if (terminalOutput[id].includes("to the Docker daemon")) terminalOutput[id] = "[Crash]: Docker is not properly setup. Contact an admin.";

  states[id] = "false";
  console.log("setting status of " + id + " to false on line #10");
});

      let count2 = 0;
      let intervalID = setInterval(() => {
        if (states[id] == "stopping") {
          console.log(count2);
          if (count2 < 5 * 24) {
            ls.stdin.write("stop\n");
            count2++;
          }
        }
      }, 200);
      eventEmitter.on("writeCmd:" + id, function () {
        ls.stdin.write(terminalInput + "\n");
      });
      ls.on("exit", (code) => {
                  if (states[id] != "false") terminalOutput[id] = out.join("\n");
        states[id] = "false";
        console.log("setting status of " + id + " to false on line #11");

        console.log(out);
        console.log("code");
        console.log(code)
        console.log(terminalOutput[id]);

        if (!fs.existsSync("assets/crashLog.txt")) {
          fs.writeFileSync("assets/crashLog.txt", "");
        }
        if (
          !terminalOutput[id].includes("stop") &&
          !terminalOutput[id].includes("Stopping server") &&
          !terminalOutput[id].includes("Stopping the server") &&
          !terminalOutput[id].includes("Server stopped")
        ) {
          fs.appendFileSync(
            "assets/crashLog.txt", Date.now().toString() + "\n" + 
            out[out.length-1] + "\n"
          );
        }
        clearInterval(intervalID);
      });
    }

    //for every item in the cmd array, run the command
    for (i in cmd) {
      if (cmd[i] != undefined && cmd[i] != "op") {
        ls.stdin.write(cmd[i] + "\n");
      }
    }

    var text = fs.readFileSync("assets/template/geyserconfig.yml", "utf8");
    var textByLine = text.split("\n");
    textByLine[15] = "  port: " + port;

    text = textByLine.join("\n");

    if (software == "paper" || software == "spigot") {
      if (
        fs.existsSync("assets/jars/geyser-spigot.jar") &&
        (fs.existsSync(folder + "/plugins/cx_geyser-spigot_Geyser.jar") ||
          isNew)
      ) {
        fs.copyFileSync(
          "assets/jars/geyser-spigot.jar",
          folder + "/plugins/cx_geyser-spigot_Geyser.jar"
        );
        fs.copyFileSync(
          "assets/jars/floodgate-spigot.jar",
          folder + "/plugins/cx_floodgate-spigot_Floodgate.jar"
        );
      }
      //create /plugins/Geyser-Spigot/
      if (!fs.existsSync(folder + "/plugins/Geyser-Spigot")) {
        fs.mkdirSync(folder + "/plugins/Geyser-Spigot");
      }
      if (!server.adminServer && !fs.existsSync(folder + "/plugins/Geyser-Spigot/config.yml")) {
        fs.writeFileSync(folder + "/plugins/Geyser-Spigot/config.yml", text);
      }

      fs.copyFile(
        "assets/template/downloading/cx_geyser-spigot_Geyser.jar",
        folder + "/plugins/cx_geyser-spigot_Geyser.jar",
        (err) => {}
      );

      fs.copyFile(
        "assets/template/downloading/cx_floodgate-spigot_Floodgate.jar",
        folder + "/plugins/cx_floodgate-spigot_Floodgate.jar",
        (err) => {}
      );
    } else if (software == "velocity") {
      if (
        fs.existsSync("assets/jars/cx_geyser-velocity_Geyser.jar") &&
        (fs.existsSync(folder + "/plugins/cx_geyser-velocity_Geyser.jar") ||
          isNew)
      ) {
        if (!isNew) {
          fs.unlinkSync(folder + "/plugins/cx_geyser-velocity_Geyser.jar");
          fs.unlinkSync(
            folder + "/plugins/cx_floodgate-velocity_Floodgate.jar"
          );
        }
        fs.copyFileSync(
          "assets/jars/cx_geyser-velocity_Geyser.jar",
          folder + "/plugins/cx_geyser-velocity_Geyser.jar"
        );
        fs.copyFileSync(
          "assets/jars/cx_floodgate-velocity_Floodgate.jar",
          folder + "/plugins/cx_floodgate-velocity_Floodgate.jar"
        );
      }
      //create /plugins/Geyser-Spigot/
      if (!fs.existsSync(folder + "/plugins/Geyser-Velocity")) {
        fs.mkdirSync(folder + "/plugins/Geyser-Velocity");
      }
      if (!server.adminServer && !fs.existsSync(folder + "/plugins/Geyser-Velocity/config.yml")) {
        fs.writeFileSync(folder + "/plugins/Geyser-Velocity/config.yml", text);
      }
      fs.copyFile(
        "assets/template/downloading/cx_geyser-velocity_Geyser.jar",
        folder + "/plugins/cx_geyser-velocity_Geyser.jar",
        (err) => {}
      );

      fs.copyFile(
        "assets/template/downloading/cx_floodgate-velocity_Floodgate.jar",
        folder + "/plugins/cx_floodgate-velocity_Floodgate.jar",
        (err) => {}
      );
    }

    let count = 0;
    //check if server is over storage limit
    let serverStorageLimit = 10;
    if (config.plus == server.productID) {
      serverStorageLimit = 15;
    } else if (config.premium == server.productID) {
      serverStorageLimit = 20;
    }
      
    files.folderSizeRecursive(folder, (size) => {
      //convert size to gb
      size = size / 1000000000;
      if (size > serverStorageLimit) {
        states[id] = "false";
        console.log("setting status of " + id + " to false on line #12");

        terminalOutput[id] =
          "Error: Server storage limit exceeded.";
        killObstructingProcess(parseInt(id));
        ls.kill();
      }
    });

  } catch (e) {
    console.log(e.message);
    terminalOutput[id] =
      "Server failed to start. Here is the error message:\n\n"+e.message+"\n"+e.stack;
    for (i in e.message.split("\n")) {
      let item = e.message.split("\n")[i];
      if (item.includes("no such file or directory, open")) terminalOutput[id] = "[Error]: Missing file "+ item.split("y, open ")[1];
    }
    states[id] = "false";
  }
}
function stop(id) {
  states[id] = "stopping";
}

function stopAsync(id, callback) {
  if (states[id] == "false") {
    callback();
  } else {
    states[id] = "stopping";
    const intervalId = setInterval(() => {
      if (states[id] === "false") {
        clearInterval(intervalId); // Clear the interval once the condition is met
        callback();
      }
    }, 200);
  }
}

function killAsync(id, callback) {
  if (states[id] == "false") {
    callback();
  } else {
    killObstructingProcess(parseInt(id));
    states[id] = "false";
    callback();
  }
}

function kill(id) {
  killObstructingProcess(parseInt(id));
  states[id] = "false";
}
function readTerminal(id) {
  let server = readJSON("servers/" + id + "/server.json");
  let ret = terminalOutput[id];

  ret = files.simplifyTerminal(ret, server.software);

  return ret;
}

function writeTerminal(id, cmd) {
  terminalInput = cmd;
  let timestamp = new Date().toLocaleTimeString();
  console.log("[" + timestamp + "] writing to terminal: " + cmd);
  eventEmitter.emit("writeCmd:" + id);
}
function downloadModpack(id, modpackURL, modpackID, versionID) {
  const folder = "servers/" + id;
  let includes = "modrinth.com";
  try {
    includes = config.labrinthUrl;
  } catch {}
  if (modpackURL.includes(includes)) {
    files.downloadAsync(
      folder + "/modpack.mrpack",
      modpackURL,
      (error, stdout, stderr) => {
        exec(
          "unzip -o " + folder + "/modpack.mrpack" + " -d " + folder,
          (error, stdout, stderr) => {
            exec(
              "cp -r " + folder + "/overrides/* " + folder + "/",
              (error, stdout, stderr) => {
                if (fs.existsSync(folder + "/modrinth.index.json")) {
                  //there's an odd bug where the file has no read access, so this changes that
                  exec("chmod +r " + folder + "/modrinth.index.json", (x) => {
                    modpack = JSON.parse(
                      fs.readFileSync(folder + "/modrinth.index.json")
                    );

                    //for each file in modpack.files, download it
                    for (i in modpack.files) {
                      //if the prefixhas a backslash, convert it to slash, as backslashes are ignored in linux
                      if (modpack.files[i].path.includes("\\")) {
                        modpack.files[i].prefix = modpack.files[i].path.replace(
                          /\\/g,
                          "/"
                        );
                      }
                      files.downloadAsync(
                        folder + "/" + modpack.files[i].path,
                        modpack.files[i].downloads[0],
                        () => {}
                      );
                    }
                    //add in modpackID so that it frontends can check for updates later
                    modpack.projectID = modpackID;
                    modpack.platform = "mr";
                    modpack.currentVersionDateAdded = Date.now();
                    modpack.versionID = versionID;
                    writeJSON(folder + "/modrinth.index.json", modpack);
                    return utils.refreshPermissions();
                   
                  });
                }
              }
            );
          }
        );
      }
    );
    //curseforge download URLs are usually from 'forgecdn.net', so we check for 'forge' instead of 'curseforge'.
  } else if (modpackURL.includes("forge")) {
    const apiKey = config.curseforgeKey;

    files.downloadAsync(
      folder + "/modpack.zip",
      modpackURL,
      (error, stdout, stderr) => {
        console.log("downloading modpack from forge...");
        //make the directory "temp"
        fs.mkdirSync(folder + "/temp");
        exec(
          "unzip -o " + folder + "/modpack.zip" + " -d " + folder + "/temp",
          (error, stdout, stderr) => {
            let overridesFolder = "/temp/overrides";
            //if theres no overrides folder, get the name of the folder inside temp
            if (!fs.existsSync(folder + "/temp/overrides")) {
              overridesFolder = "/temp";
              //deletes .txt files, so it only moves over mods and configs and such
              exec(
                "find " + folder + "/temp -type f -name '*.txt' -delete",
                () => {}
              );

              if (fs.existsSync(folder + "/temp/server.properties")) {
                fs.unlinkSync(folder + "/temp/server.properties");
              }

              //this detects if theres only one folder in the temp folder
              let tempFiles = fs.readdirSync(folder + "/temp");
              if (tempFiles.length == 1 && tempFiles[0] != "mods") {
                let subfolderFiles = fs.readdirSync(
                  folder + "/temp/" + tempFiles[0]
                );
                for (i in subfolderFiles) {
                  if (subfolderFiles[i] != "server.properties") {
                    fs.renameSync(
                      folder +
                        "/temp/" +
                        tempFiles[0] +
                        "/" +
                        subfolderFiles[i],
                      folder + "/temp/" + subfolderFiles[i]
                    );
                  }
                }
              }

              console.log(overridesFolder);
            }

            console.log("unzipping modpack...");
            console.log(error + " " + stderr);
            exec(
              "cp -r " + folder + overridesFolder + "/* " + folder + "/",
              (error, stdout, stderr) => {
                if (fs.existsSync(folder + "/temp/manifest.json")) {
                  //there's an odd bug where the file has no read access, so this changes that
                  exec("chmod +r " + folder + "/temp/manifest.json", (x) => {
                    fs.copyFileSync(
                      folder + "/temp/manifest.json",
                      folder + "/curseforge.index.json"
                    );
                    modpack = JSON.parse(
                      fs.readFileSync(folder + "/curseforge.index.json")
                    );
                    for (i in modpack.files) {
                      let projectID = modpack.files[i].projectID;
                      let fileID = modpack.files[i].fileID;
                      console.log(projectID + " " + fileID);
                      exec(
                        `curl -X GET "https://api.curseforge.com/v1/mods/${projectID}/files/${fileID}/download-url" -H 'x-api-key: ${apiKey}'`,
                        (error, stdout, stderr) => {
                          if (stdout != undefined) {
                            try {
                              files
                                .downloadAsync(
                                  folder +
                                    "/mods/cf_" +
                                    projectID +
                                    "_CFMod.jar",
                                  JSON.parse(stdout).data
                                )
                                .then(() => {});
                            } catch {
                              console.log(
                                "error parsing json for " + projectID
                              );
                            }
                          }
                        }
                      );
                    }
                    console.log("modpackID:" + modpackID);
                    //add in modpackID so that it frontends can check for updates later
                    modpack.projectID = modpackID;
                    modpack.platform = "cf";
                    modpack.currentVersionDateAdded = Date.now();
                    modpack.versionID = versionID;
                    writeJSON(folder + "/curseforge.index.json", modpack);

                    //remove temp folder
                    exec("rm -r " + folder + "/temp");
                    return;
                  });
                }
              }
            );
          }
        );
      }
    );
  }
}

function killObstructingProcess(id) {
  try {
    exec(
      `docker ps --filter "publish=${portOffset + id}" --format "{{.ID}}"`,
      (error, stdout, stderr) => {
        let pid = stdout.trim();
        console.log("killing obstructing container " + pid);
        exec("docker stop " + pid);

        setTimeout(() => {
          exec("docker kill " + pid);
        }, 2500);
      }
    );
  } catch (e) {
    console.log(e);
  }
}

module.exports = {
  run,
  stop,
  kill,
  checkServer,
  readTerminal,
  writeTerminal,
  stopAsync,
  proxiesToggle,
  getState,
  downloadModpack,
  killAsync,
  getServersOnThreads
};
