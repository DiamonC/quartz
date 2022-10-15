
// Unpause the stdin stream:
process.stdin.resume();
// Listen for incoming data:
process.stdin.on('data', function (data) {
    if(data == "req.stop.server") {
        console.log("Stopping Server..");
    } else {
    console.log('Received data: ' + data);
    }
});

process.on('SIGUSR2', function () {
    console.log("Stopping Server");
});