var net = require('net');

console.log('instancied');
var server = net.createServer(function(socket) {
  socket.write((process.env.PORT || '8087') + '\r\n');
  socket.pipe(socket);
});

server.listen(process.env.PORT || '8087', '127.0.0.1');
