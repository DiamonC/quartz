const { spawn } = require("child_process").spawn;
const { exec } = require("child_process");

const path = "java/17/bin/java";
const techname = "yourserver";
exec(`cp -r template ${techname}`);

spawn(
  `../${path} -jar server.jar`,
  { cwd: `${techname}` },
  (error, stdout, stderr) => {
    if (error) {
      console.log(`error: ${error.message}`);
      return;
    }
    if (stderr) {
      console.log(`stderr: ${stderr}`);
      return;
    }
    console.log(`stdout: ${stdout}`);
  }
);
