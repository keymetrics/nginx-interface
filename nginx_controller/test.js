const WS = require('ws');

const ws = new WS('ws://localhost:9003/', {
  perMessageDeflate: false
});

ws.on('message', (data) => {
  console.log(data);
  //done();
});
