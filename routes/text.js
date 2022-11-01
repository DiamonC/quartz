var fs = require('fs')
fs.appendFile('servers.txt', 'new data', function(err) {
	if (err) {
		// append failed
		console.log("hi")
	} else {
		// done
		console.log("bye")
	}
});