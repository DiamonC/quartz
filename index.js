// importing packages
const express = require("express");
const app = express();
const account = require("./routes/account");
// middlewares
app.use(express.json());
// adding routes
app.use("/hello", require("./routes/hello"));
app.use("/account", account);
app.use("/discord", require("./routes/discord"));
// port
const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Listening on Port: ${port}`));


app.use((err, req, res, next) => {
    switch (err.message) {
      case 'NoCodeProvided':
        return res.status(400).send({
          status: 'ERROR',
          error: err.message,
        });
      default:
        return res.status(500).send({
          status: 'ERROR',
          error: err.message,
        });
    }
  });