
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/terminal.html');
});

io.on('connection', (socket) => {
  console.log('Connection Established');
});

server.listen(4001, () => {
  console.log('listening on *:4001');
});