const { exec } = require('child_process');
const { promisify } = require('util');
const execPromise = promisify(exec);
const fs = require('fs');

const servers = [];

let serverFolderItems = fs.readdirSync('./servers');
for (let i = 0; i < serverFolderItems.length; i++) {
    if (!isNaN(serverFolderItems[i])) {
        servers.push(parseInt(serverFolderItems[i]));
    }
}

async function getStats(serverId) {
    try {
        const port = 10000 + parseInt(serverId);
        const { stdout: containerId } = await execPromise(
            `docker ps --filter "publish=${port}" --format "{{.ID}}"`
        );

        const pid = containerId.trim();
        if (!pid) return { memory: { used: 0, total: 0 }, cpu: 0 };

        const { stdout: memoryStats } = await execPromise(
            `docker stats ${pid} --no-stream --format "{{.MemUsage}} {{.CPUPerc}}"`
        );

        let [used, slash, total, cpuUsage] = memoryStats.trim().split(' ').map(s => s.trim());
       
 
        // Convert MiB to bytes and GiB to bytes
        if (used.includes('MiB')) {
            used = parseFloat(used) * 1024 * 1024;
        } else if (used.includes('GiB')) {
            used = parseFloat(used) * 1024 * 1024 * 1024;
        }
        if (total.includes('MiB')) {
            total = parseFloat(total) * 1024 * 1024;
        } else if (total.includes('GiB')) {
            total = parseFloat(total) * 1024 * 1024 * 1024;
        }

        // Convert CPU usage to float and remove percentage sign
        cpuUsage = parseFloat(cpuUsage.replace('%', ''));

        return { memory: { used, total }, cpu: cpuUsage };
    } catch (error) {
        console.error(`Error fetching stats for server ${serverId}:`, error);
        return null;
    }
}

const stats = {};
for (let i = 0; i < servers.length; i++) {
    stats["server_" + servers[i]] = [];
}

async function cycle() {
    for (let i = 0; i < servers.length; i++) {
        const data = await getStats(servers[i]);
        if (data) {
            const object = { memory: data.memory, cpu: data.cpu, timestamp: Date.now() };
            const key = "server_" + servers[i];
            if (stats[key].length > 60) {
                stats[key].shift(); // Keep only the latest 60 entries
            }
            stats[key].push(object);
        }
    }
}

// Run immediately, then every 15 seconds
cycle();
setInterval(cycle, 1000 * 15);

function getLiveStats(serverId) {
    return stats["server_" + serverId] || [];
}

module.exports = { getLiveStats };
