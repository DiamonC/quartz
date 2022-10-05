// importing packages
const express = require("express");
const app = express();
const hello = require(".routes/hello");

// middlewares
app.use(express.json());
// port
const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Listening on Port: ${port}`));
