const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');

// Import utility functions
const utils = require('./utils.js');

/**
 * Read JSON file
 * @param {string} filePath - Path to the JSON file
 * @returns {Object} - Parsed JSON object
 */
function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error(`Error reading JSON file ${filePath}:`, e);
    return null;
  }
}

/**
 * Write JSON file
 * @param {string} filePath - Path to the JSON file
 * @param {Object} data - Data to write
 */
function writeJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(`Error writing JSON file ${filePath}:`, e);
  }
}

/**
 * Delete subdomain from Cloudflare
 * @param {string} subdomain - Subdomain to delete
 * @param {Object} config - Configuration object
 * @returns {Promise} - Promise that resolves when subdomain is deleted
 */
function deleteSubdomain(subdomain, config) {
  return new Promise((resolve, reject) => {
    if (!subdomain) {
      console.log('No subdomain provided');
      resolve({ success: false, message: 'No subdomain provided' });
      return;
    }

    console.log(`Deleting subdomain: ${subdomain}`);
    
    // Delete _minecraft._tcp record
    exec(
      `curl https://api.cloudflare.com/client/v4/zones/${config.cloudflareZone}/dns_records?name=_minecraft._tcp.${subdomain} \\
      -X DELETE \\
      -H 'Content-Type: application/json' \\
      -H "X-Auth-Email: ${config.cloudflareEmail}" \\
      -H "X-Auth-Key: ${config.cloudflareKey}"`,
      (err, stdout, stderr) => {
        if (err) {
          console.error(`Error deleting _minecraft._tcp.${subdomain}:`, err);
          reject(err);
          return;
        }
        
        try {
          const res = JSON.parse(stdout);
          console.log(`Result of deleting _minecraft._tcp.${subdomain}:`, res);
          
          // Delete _minecraft._udp record
          exec(
            `curl https://api.cloudflare.com/client/v4/zones/${config.cloudflareZone}/dns_records?name=_minecraft._udp.${subdomain} \\
            -X DELETE \\
            -H 'Content-Type: application/json' \\
            -H "X-Auth-Email: ${config.cloudflareEmail}" \\
            -H "X-Auth-Key: ${config.cloudflareKey}"`,
            (err2, stdout2, stderr2) => {
              if (err2) {
                console.error(`Error deleting _minecraft._udp.${subdomain}:`, err2);
                reject(err2);
                return;
              }
              
              try {
                const res2 = JSON.parse(stdout2);
                console.log(`Result of deleting _minecraft._udp.${subdomain}:`, res2);
                resolve({ success: true, message: 'Subdomain deleted successfully' });
              } catch (e) {
                console.error(`Error parsing response for _minecraft._udp.${subdomain}:`, e);
                reject(e);
              }
            }
          );
        } catch (e) {
          console.error(`Error parsing response for _minecraft._tcp.${subdomain}:`, e);
          reject(e);
        }
      }
    );
  });
}

/**
 * Clean up subdomains for inactive subscriptions
 */
async function cleanupInactiveSubdomains() {
  console.log('Starting subdomain cleanup for inactive subscriptions...');
  
  // Load configuration
  const config = utils.getConfig();
  
  if (!config.cloudflareKey || !config.cloudflareEmail || !config.cloudflareZone) {
    console.error('Cloudflare configuration missing. Skipping subdomain cleanup.');
    return;
  }
  
  // Check if subscriptions file exists
  if (!fs.existsSync('logs/subscriptions.json')) {
    console.error('Subscriptions file not found. Skipping subdomain cleanup.');
    return;
  }
  
  // Read subscriptions data
  const subscriptionsData = readJSON('logs/subscriptions.json');
  if (!subscriptionsData) {
    console.error('Failed to read subscriptions data. Skipping subdomain cleanup.');
    return;
  }
  
  // Process each server in the subscriptions data
  for (const entry of subscriptionsData) {
    const serverId = entry.serverId;
    const serverJsonPath = `servers/${serverId}/server.json`;
    
    // Skip if server.json doesn't exist
    if (!fs.existsSync(serverJsonPath)) {
      console.log(`Server ${serverId} does not exist. Skipping.`);
      continue;
    }
    
    // Read server configuration
    const serverJson = readJSON(serverJsonPath);
    if (!serverJson) {
      console.log(`Failed to read server.json for server ${serverId}. Skipping.`);
      continue;
    }
    
    // Skip if no subdomain
    if (!serverJson.subdomain) {
      console.log(`Server ${serverId} has no subdomain. Skipping.`);
      continue;
    }
    
    // Check if server has active subscriptions
    let hasActiveSubscription = false;
    if (entry.subscriptions && Array.isArray(entry.subscriptions)) {
      for (const subscription of entry.subscriptions) {
        if (subscription.status === 'active') {
          hasActiveSubscription = true;
          break;
        }
      }
    }
    
    // If no active subscriptions, delete the subdomain
    if (!hasActiveSubscription) {
      console.log(`Server ${serverId} has no active subscriptions. Deleting subdomain ${serverJson.subdomain}.`);
      try {
        const result = await deleteSubdomain(serverJson.subdomain, config);
        if (result.success) {
          console.log(`Successfully deleted subdomain ${serverJson.subdomain} for server ${serverId}.`);
          
          // Update server.json to remove subdomain
          serverJson.subdomain = undefined;
          writeJSON(serverJsonPath, serverJson);
          console.log(`Updated server.json for server ${serverId}.`);
        } else {
          console.error(`Failed to delete subdomain ${serverJson.subdomain} for server ${serverId}.`);
        }
      } catch (error) {
        console.error(`Error deleting subdomain ${serverJson.subdomain} for server ${serverId}:`, error);
      }
    } else {
      console.log(`Server ${serverId} has active subscriptions. Keeping subdomain ${serverJson.subdomain}.`);
    }
  }
  
  console.log('Subdomain cleanup completed.');
}

// Export functions
module.exports = {
  cleanupInactiveSubdomains
};

// Run cleanup
if (require.main === module) {
  cleanupInactiveSubdomains().catch(console.error);
}
