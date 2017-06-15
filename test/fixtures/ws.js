
const WebSocket = require('ws');

console.log(`Launching websocket server on port ${process.env.PORT}`);
const ws = new WebSocket.Server({
  perMessageDeflate: false,
  port: process.env.PORT
});

ws.on('connection', function open(client) {
  console.log('got connection');
  client.send(process.env.PORT);
});
