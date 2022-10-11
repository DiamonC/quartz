const { exec } = require("child_process");
const fs = require("fs.extra");
const path = "java/17/bin/java";
const techname = "yourserver";
exec(`cp -r template ${techname}`);

exec(
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
