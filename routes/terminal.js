const express = require("express");
const router = express.Router();
const http = require("http").Server(express);
const io = require("socket.io")(http);
const port = process.env.PORT || 4000;

router.get("/", (req, res) => {
  res.sendFile(__dirname + "/terminal.html");
});

io.on("connection", (socket) => {
  socket.on("chat message", (msg) => {
    io.emit("chat message", msg);
  });
});

http.listen(port, () => {
  console.log(`Socket.IO server running at http://localhost:${port}/`);
});
module.exports = router;
