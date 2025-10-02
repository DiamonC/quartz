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
 * Delete DNS record from Cloudflare by record ID
 * @param {string} recordId - DNS record ID to delete
 * @param {Object} config - Configuration object
 * @returns {Promise} - Promise that resolves when record is deleted
 */
function deleteDNSRecord(recordId, config) {
  return new Promise((resolve, reject) => {
    if (!recordId) {
      console.log('No record ID provided');
      resolve({ success: false, message: 'No record ID provided' });
      return;
    }

    console.log(`Deleting DNS record: ${recordId}`);
    
    exec(
      `curl -X DELETE "https://api.cloudflare.com/client/v4/zones/${config.cloudflareZone}/dns_records/${recordId}" \\
      -H "X-Auth-Email: ${config.cloudflareEmail}" \\
      -H "X-Auth-Key: ${config.cloudflareKey}" \\
      -H "Content-Type: application/json"`,
      (err, stdout, stderr) => {
        if (err) {
          console.error(`Error deleting DNS record ${recordId}:`, err);
          reject(err);
          return;
        }
        
        try {
          const res = JSON.parse(stdout);
          console.log(`Result of deleting DNS record ${recordId}:`, res);
          resolve({ success: res.success, message: res.success ? 'Record deleted successfully' : 'Failed to delete record' });
        } catch (e) {
          console.error(`Error parsing response for DNS record ${recordId}:`, e);
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
  const config = require("./utils.js").getConfig();
  
  if (!config.cloudflareKey || !config.cloudflareEmail || !config.cloudflareZone) {
    console.error('Cloudflare configuration missing. Skipping subdomain cleanup.');
    return;
  }

  
  // Check each ID to see if it has a subdomain

  const idOffset = config.idOffset || 0;
  const maxServers = config.maxServers || 32;
  console.log(idOffset, maxServers);
  for (let i = idOffset; i < parseInt(idOffset) + parseInt(maxServers); i++) {
    const id = i;
    let validSubdomain = null;

    // If the server exists, check for subdomain to exclude from deletions
    if (fs.existsSync(`servers/${id}`) && fs.existsSync(`servers/${id}/server.json`)) {
      try {
        const serverJson = readJSON(`servers/${id}/server.json`);
        if (serverJson.subdomain) {
          validSubdomain = serverJson.subdomain;  
        }
      } catch (e) {
        console.error(`Error processing ID ${id}:`, e);
      }
    }

    // get all subdomains from cloudflare under this ID
    let subdomainItems = await getSubdomainItems(id);
    for (const item of subdomainItems) {
      let isValid = validSubdomain && item.name.includes(validSubdomain);
      if (!isValid) {
        // Delete the DNS record using its ID
        try {
          const result = await deleteDNSRecord(item.id, config);
          console.log(`Deleting DNS record ${item.id} (${item.name}) for server ID ${id}:`, result);
        } catch (e) {
          console.error(`Error deleting DNS record ${item.id} for server ID ${id}:`, e);
        }
      } else {
        console.log(`Skipping valid subdomain ${item.name} for ID ${id}`);
      }
    }
  }
  
  console.log('Subdomain cleanup completed.');
}

async function getSubdomainItems(id) {
  const config = require("./utils.js").getConfig();
  
  if (!config.cloudflareKey || !config.cloudflareEmail || !config.cloudflareZone) {
    console.error('Cloudflare configuration missing.');
    return [];
  }

  const port = 10000 + id;

  return new Promise((resolve, reject) => {
    exec(
      `curl -X GET "https://api.cloudflare.com/client/v4/zones/${config.cloudflareZone}/dns_records?type=SRV&content.contains=${port}" \\
      -H "X-Auth-Email: ${config.cloudflareEmail}" \\
      -H "X-Auth-Key: ${config.cloudflareKey}" \\
      -H "Content-Type: application/json"`,
      (err, stdout, stderr) => {
        if (err) {
          console.error(`Error fetching DNS records for ID ${id}:`, err);
          reject(err);
          return;
        }

        try {
          const response = JSON.parse(stdout);
          
          if (!response.success) {
            console.error(`Cloudflare API error for ID ${id}:`, response.errors);
            resolve([]);
            return;
          }

          console.log(`Found ${response.result.length} DNS records for ID ${id} (port ${port})`);
          resolve(response.result);
        } catch (e) {
          console.error(`Error parsing response for ID ${id}:`, e);
          reject(e);
        }
      }
    );
  });
}

// Export functions
module.exports = {
  cleanupInactiveSubdomains
};

// Run cleanup
if (require.main === module) {
  cleanupInactiveSubdomains().catch(console.error);
}