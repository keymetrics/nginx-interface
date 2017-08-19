
var Nginx = require('./src/nginx.js');
var Log = require('./src/log.js');

module.exports = Nginx;

if (require.main == module) {
  var nginx = new Nginx({
    pid : null,
    conf : null,
    debug_mode : false
  });

  nginx.launchDiscovery();
  nginx.once('ready', function(data) {
    nginx.launchInterface();
    console.log('Nginx instance and interface READY [conf=%s, pid=%s]', data.conf, data.pid);
  });

  nginx.on('error', function(err) {
    console.error(`[${new Date()}] ${err}`);
  });
}
