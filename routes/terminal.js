const express = require("express");
const router = express.Router();
const http = require("http").Server(express);
const io = require("socket.io")(http);
const port = process.env.PORT || 4001;

router.get("/terminal", (req, res) => {
  res.sendFile(__dirname + "/terminal.html");
});

io.on("connection", (socket) => {
  console.log("a user connected");
  socket.on("chat message", (msg) => {
    io.emit("chat message", msg);
  });
  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});
