// importing packages
const express = require("express");
const app = express();
const hello = require("./routes/hello");
const account = require("./routes/account");
// middlewares
app.use(express.json());
// adding routes
app.use("/hello", hello);
app.use("/account", account);
// port
const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Listening on Port: ${port}`));
