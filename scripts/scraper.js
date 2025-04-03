const jQuery = require("jquery");
const {JSDOM} = require("jsdom");
const fs = require("fs");
const $ = jQuery(new JSDOM().window);
const {exec} = require("child_process");
const files = require("./files.js");

let skipOldVersions = false;

let index = {};

//paper
async function downloadPaperJars() {
    const response = await fetch("https://api.papermc.io/v2/projects/paper");
    const paperVersions = await response.json();
    for (let i in paperVersions.versions) {
        let version = paperVersions.versions[i];
        const response = await fetch(`https://api.papermc.io/v2/projects/paper/versions/${version}/builds`);
        const builds = await response.json();
        const build = builds.builds[builds.builds.length - 1].build;
        let channel = builds.builds[builds.builds.length - 1].channel;
        if (channel == "experimental") {
            channel = "beta";
        } else if (channel == "default") {
            channel = "release";
        }
        const link = `https://api.papermc.io/v2/projects/paper/versions/${version}/builds/${build}/downloads/paper-${version}-${build}.jar`;
        const filename = `paper-${version}-${channel}.jar`;

        if (!skipOldVersions || getMajorVersion(version, 1) >= 21) {
            index[filename] = link;
    }
    //if the channel is release and theres an existing beta jar, delete it
    if (channel == "release") {
        const betaFilename = `paper-${version}-beta.jar`;
        if (index[betaFilename]) {
            delete index[betaFilename];
        }
        if (fs.existsSync(`assets/jars/${betaFilename}`)) {
            fs.unlinkSync(`assets/jars/${betaFilename}`);
        }   
    }

        
    

    }
}


//velocity
async function downloadVelocityJars() {
    //use papermc api
    const response = await fetch("https://api.papermc.io/v2/projects/velocity");
    const velocityVersions = await response.json();
    for (let i in velocityVersions.versions) {
        let version = velocityVersions.versions[i];
        const response = await fetch(`https://api.papermc.io/v2/projects/velocity/versions/${version}/builds`);
        const builds = await response.json();
        const build = builds.builds[builds.builds.length - 1].build;
        let channel = "release";
        if (version.includes("SNAPSHOT")) {
            channel = "beta";
        }

        const link = `https://api.papermc.io/v2/projects/velocity/versions/${version}/builds/${build}/downloads/velocity-${version}-${build}.jar`;
        version = version.split("-")[0];
        const filename = `velocity-${version}-${channel}.jar`;

        if (!skipOldVersions || getMajorVersion(version, 1) >= 21) {
            index[filename] = link;
    }

        //
    

    }
}

async function downloadForgeJars() {
    const response = await fetch("https://files.minecraftforge.net/maven/net/minecraftforge/forge/index.html");

    // Wait for the response text to resolve
    const minecraftVersionsHtml = $(await response.text());

    // section.sidebar-nav li.li-version-list > ul > li
    let minecraftVersions = minecraftVersionsHtml.find("section.sidebar-nav li.li-version-list > ul > li > a").toArray();
    let latest = minecraftVersionsHtml.find("section.sidebar-nav li.li-version-list > ul > li.elem-active").toArray()[0];
    minecraftVersions.push(latest);
    console.log(minecraftVersions)
    for (let i in minecraftVersions) {
        let url = "https://files.minecraftforge.net/maven/net/minecraftforge/forge/index_"+minecraftVersions[i].textContent.trim()+".html";
        console.log(url)
        const response2 = await fetch(url);
        let forgeVersionsHtml = $(await response2.text());

        let forgeVersionChannels = forgeVersionsHtml.find(".downloads > .download > .title").toArray();
        let forgeVersionLinks = forgeVersionsHtml.find(".downloads > .download > .links > .link-boosted > a").toArray();
        for (let j in forgeVersionLinks) {
            let channel = Array.from(forgeVersionChannels[j].childNodes)
            .filter(node => node.nodeType === 3)[1]
            .nodeValue.trim().split(" ")[1].toLowerCase();
            let link = forgeVersionLinks[j].href.split("&url=")[1];
            let components = link.split("/").pop().split("-");
            let filename = "forge-" + components[1] + "-" + channel + ".jar";

            if (components[1].includes("1.7.10_pre4")) {
                if (!skipOldVersions || getMajorVersion(components[i], 1) >= 21) {
                    index[filename] = link;
            }
            }
        }


    }



}

// neoforge
async function downloadNeoforgeJars() {
    const response = await fetch("https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge");
    let neoforgeVersions = await response.json();
    neoforgeVersions = neoforgeVersions.versions;

    const latestVersions = [];
    for (let i = neoforgeVersions.length - 1; i >= 0; i--) {
        let version = neoforgeVersions[i];
        let minecraftVersion = version.split(".")[0] + "." + version.split(".")[1];

        let minecraftVersionAlreadyPresent = false;
        for (let j in latestVersions) {
            let version2 = latestVersions[j];

            if (version2.includes(minecraftVersion)) {
                minecraftVersionAlreadyPresent = true;
                break;
            }
        }

        if (!minecraftVersionAlreadyPresent) {
            latestVersions.push(version);
        }
    }

    for (let i in latestVersions) {
        let url = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${latestVersions[i]}/neoforge-${latestVersions[i]}-installer.jar`;
        let minecraftVersion = "1." + latestVersions[i].split(".")[0] + "." + latestVersions[i].split(".")[1];
        let channel = "release";
        if (latestVersions[i].includes("beta")) {
            channel = "beta";
        }
        let filename = `neoforge-${minecraftVersion}-${channel}.jar`;

        if (!skipOldVersions || getMajorVersion(minecraftVersion, 0) >= 21) {
            index[filename] = url;
    }

    }
}

function getMajorVersion(version, i) {
    try {
        return parseInt(version.split(".")[i]);
    } catch (e) {
        return 0;
    }
}


async function downloadQuiltJars() {
    const url = "https://quiltmc.org/api/v1/download-latest-installer/java-universal";

    let filename = "quilt-installer.jar";

        index[filename] = url;

}

async function downloadFabricJars() {
    const response = await fetch("https://meta.fabricmc.net/v2/versions/game");
    const fabricVersions = await response.json();

    //get latest loader version
    const response2 = await fetch("https://meta.fabricmc.net/v2/versions/loader");
    const fabricLoaderVersions = await response2.json();
    const latestLoaderVersion = fabricLoaderVersions[0].version;

    //get latest installer version
    const response3 = await fetch("https://meta.fabricmc.net/v2/versions/installer");
    const fabricInstallerVersions = await response3.json();
    const latestInstallerVersion = fabricInstallerVersions[0].version;

    for (let i in fabricVersions) {
        if (fabricVersions[i].stable) {
            const url = `https://meta.fabricmc.net/v2/versions/loader/${fabricVersions[i].version}/${latestLoaderVersion}/${latestInstallerVersion}/server/jar`;
            const filename = `fabric-${fabricVersions[i].version}.jar`;

            if (!skipOldVersions || getMajorVersion(fabricVersions[i].version, 0) >= 21) {
                index[filename] = url;

            
        }

    }
}
}

async function downloadGeyserJars() {

    
        index["geyser-spigot.jar"] = "https://download.geysermc.org/v2/projects/geyser/versions/latest/builds/latest/downloads/spigot";	
        index["floodgate-spigot.jar"] = "https://download.geysermc.org/v2/projects/floodgate/versions/latest/builds/latest/downloads/spigot";
}

async function downloadWorldgenMods() {
    let worldgenMods = ["terralith", "incendium", "nullscape", "structory"];
    for (let z in worldgenMods) {

        


    const response = await fetch(`https://api.modrinth.com/v2/project/${worldgenMods[z]}/version?loaders=[%22datapack%22]`);
    const versions = await response.json();

    let minecraftVersions = [];

    for (let i in versions) {
        if (worldgenMods[z] != undefined) {

        let url = versions[i].files[0].url;
        let channel = versions[i].version_type;
        for (let j in versions[i].game_versions) {
            let minecraftVersion = versions[i].game_versions[j];
            let minecraftVersionAlreadyPresent = false;
            for (let k in minecraftVersions) {
                if (minecraftVersions[k].split("*")[0] == minecraftVersion && minecraftVersions[k].split("*")[2] == channel) {
                    minecraftVersionAlreadyPresent = true;
                    break;
                }
            }
            if (!minecraftVersionAlreadyPresent) {
                minecraftVersions.push(minecraftVersion+"*"+url+"*"+channel);
            }
        }  
    } 
    }

    for (let i in minecraftVersions) {
        if (worldgenMods[z] != undefined) {
        let minecraftVersion = minecraftVersions[i].split("*")[0];
        let url = minecraftVersions[i].split("*")[1];
        let channel = minecraftVersions[i].split("*")[2];
        let filename = `${worldgenMods[z]}-${minecraftVersion}-${channel}.zip`;
        if (!skipOldVersions || getMajorVersion(minecraftVersion, 1) >= 21) {
            index[filename] = url;
    }
    }
}
    
}
}
function downloadSnapshotJars() {
    files.GET(
      "https://launchermeta.mojang.com/mc/game/version_manifest.json",
      (vdata) => {
        try {
          const json = JSON.parse(vdata);
          if (json.latest.snapshot == json.versions[0].id) {
            files.GET(json.versions[0].url, (data) => {
              try {
                const version = JSON.parse(data);
                if (version.downloads.server != undefined) {
    
  index["snapshot-" + json.versions[0].id + ".jar"] = version.downloads.server.url;

                }
              } catch (e) {
                //console.log(e);
              }
            });
          }
        } catch (e) {
          //console.log(e);
        }
      }
    );
  }

  function downloadVanillaJars() {
    files.GET(
        "https://launchermeta.mojang.com/mc/game/version_manifest.json",
        (vdata) => {
            try {
                const json = JSON.parse(vdata);
                for (let i in json.versions) {
                    let version = json.versions[i];
                    if (version.type == "release") {
                        files.GET(version.url, (data) => {
                            try {
                                const version = JSON.parse(data);
                                if (version.downloads.server != undefined) {
                                    if (!skipOldVersions || getMajorVersion(version.id, 1) >= 21) { 
                                    index["vanilla-" + version.id + ".jar"] = version.downloads.server.url;
                                    }
                                }
                            } catch (e) {
                                //console.log(e);
                            }
                        });
                    }
                }
            } catch (e) {
                //console.log(e);
            }

        }   
    );
}   


function fullDownload() {
    skipOldVersions = false;;
    try {
        downloadPaperJars();
    setTimeout(() => downloadVelocityJars(), 500);
    setTimeout(() => downloadForgeJars(), 1000);
    setTimeout(() => downloadNeoforgeJars(), 1500);
    setTimeout(() => downloadQuiltJars(), 2000);
    setTimeout(() => downloadFabricJars(), 2250);
    setTimeout(() => downloadGeyserJars(), 2500);
    setTimeout(() => downloadWorldgenMods(), 3000);
    setTimeout(() => downloadSnapshotJars(), 3500);
    setTimeout(() => downloadVanillaJars(), 4000);  
    setTimeout(() => done(), 30000);
    } catch (e) {
        //console.log(e);
    }

}

function done() {
    const indexJson = JSON.stringify(index);
    fs.writeFileSync("assets/scraper.json", indexJson);
    //console.log("Done running jars scraper");
}

function partialDownload() {

    skipOldVersions = true;
    try {
        downloadPaperJars();
    setTimeout(() => downloadVelocityJars(), 100);
    setTimeout(() => downloadForgeJars(), 200);
    setTimeout(() => downloadNeoforgeJars(), 300);
    setTimeout(() => downloadQuiltJars(), 400);
    setTimeout(() => downloadFabricJars(), 450);
    setTimeout(() => downloadGeyserJars(), 500);
    setTimeout(() => downloadWorldgenMods(), 600);
    setTimeout(() => downloadSnapshotJars(), 700);
    setTimeout(() => downloadVanillaJars(), 800);
    setTimeout(() => done(), 10000);
    } catch {
        //console.log(e);
    }

}

partialDownload();


module.exports = {fullDownload, partialDownload};
