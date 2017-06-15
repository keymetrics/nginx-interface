
var http = require('http');

var server = http.createServer(function(req, res) {
  res.writeHead(200);
  res.end(process.env.PORT);
}).listen(process.env.PORT || 8000, function() {
  console.log('Listening on %s', server.address().port);
});
