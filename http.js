
var http = require('http');

var server = http.createServer(function(req, res) {
  res.writeHead(200);
  res.end('hey ' + server.address().port);
}).listen(process.env.PORT || 8000, function() {
  console.log('Listening on %s', server.address().port);
});
