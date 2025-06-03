const fs = require('fs');
process.stdin.setEncoding('utf8');

console.log(`We're going to quickly setup this instance of quartz now.\n`);
console.log(`(1/4) Enable provider mode? (If you don't know what this is, say false):`);

let providerMode;
process.stdin.once('data', (input) => {
  const trimmedInput = input.trim();

  
  if (trimmedInput === 'true' || trimmedInput === 'false') {
    let parsedBool = trimmedInput === 'true';
    providerMode = parsedBool;
    if (parsedBool) {
        console.log(`\n(2/4) Enable docker mode? (HIGHLY RECCOMENDED for provider mode):`);
    } else {
        console.log(`\n(2/4) Enable docker mode? (Necesssary for FTP, you will need to figure out how to install docker):`);
    }
    process.stdin.once('data', (input) => {
      const dockerMode = input.trim() === 'true';
      
      console.log(`\n(3/4) What should be the maximum number of servers on this node? (Max of 32):`);
      process.stdin.once('data', (input) => {
        const maxServers = parseInt(input.trim());
        if (isNaN(maxServers) || maxServers < 1 || maxServers > 32) {
          console.log(`Invalid input. Please enter a number between 1 and 32.`);
          return;
        }

        console.log(`\n(4/4) What is the name of this instance? (Ex: "us-seattle-1"):`);
        process.stdin.once('data', (input) => {
          const instanceName = input.trim();

          console.log(`\nSetting up Quartz with the following configuration:`);
          console.log(`Provider Mode: ${providerMode}`);
          console.log(`Docker Mode: ${dockerMode}`);
          console.log(`Max Servers: ${maxServers}`);
          console.log(`Instance Name: ${instanceName}`);
  fs.copyFileSync("assets/template/config.txt", "config.txt");
          //look for the line with "providerMode=", etc
            let configContent = fs.readFileSync('config.txt', 'utf8');
            configContent = configContent.replace(/providerMode=.*/, `providerMode=${providerMode}`);
            configContent = configContent.replace(/dockerMode=.*/, `dockerMode=${dockerMode}`);
            configContent = configContent.replace(/maxServers=.*/, `maxServers=${maxServers}`);
            configContent = configContent.replace(/nodeName=.*/, `nodeName=${instanceName}`);
            fs.writeFileSync('config.txt', configContent);
          process.exit();
        });
      });
    });
   
  }
});
