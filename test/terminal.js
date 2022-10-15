
const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const port = process.env.PORT || 3500;

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/terminal.html');
});

io.on('connection', (socket) => {
  socket.on('chat message', (msg) => {
    console.log(msg)
    io.emit('chat message', msg);
  });
  console.log('a user connected');
  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});


http.listen(port, () => {
  console.log(`Socket.IO server running at http://localhost:${port}/`);
});