
const Nginx = require('..');
const needle = require('needle');
const pm2 = require('pm2');
const should = require('should');
const WS = require('ws');

var Helpers = {};

Helpers.do_query = function(url, cb) {
  needle.get(url, (err, res, body) => {
    should(err).be.null();
    cb(null, body.toString());
  });
}

/**
 * Check if application is available for
 * @param check_time time to check if no error
 */
Helpers.multi_query = function(needed_port_range, cb) {
  if (needed_port_range == 0)
    return cb(null, { success : true });

  Helpers.do_query('http://localhost:9001', (err, port) => {
    needed_port_range.forEach(function(t_port, i) {
      if (t_port == parseInt(port)) {
        t_port = needed_port_range.splice(i, 1);
      }
    });
    Helpers.multi_query(needed_port_range, cb);
  });
}

/**
 * Check if application is available for
 * @param check_time time to check if no error
 */
Helpers.check_availability = function(check_time, cb) {
  const INTERVAL = 5;
  var iterations = check_time / INTERVAL;

  (function query(iterations) {
    if (iterations <= 0) return cb(null, { success : true });
    setTimeout(() => {
      Helpers.do_query('http://localhost:9001', (err, port) => {
        if (err) {
          console.error(err);
          return cb(err);
        }
        iterations--;
        query(iterations);
      });
    }, INTERVAL);
  })(iterations);
}

Helpers.connectWS = function(PORT, cb) {
  var WebSocketClient = require('websocket').client;

  var client = new WebSocketClient();

  client.on('connectFailed', function(error) {
    console.log('Connect Error: ' + error.toString());
  });

  client.on('connect', function(connection) {
    connection.on('error', function(error) {
      console.log('Connection Error: ' + error.toString());
      return cb(error);
    });
    connection.on('close', function() {
    });
    connection.on('message', function(message) {
      connection.close();
      return cb(null, message.utf8Data);
    });
  });
  client.connect('ws://localhost:' + PORT + '/', 'echo-protocol');
}

Helpers.connectTCP = function(PORT, cb) {
  var net = require('net');

  var client = new net.Socket();
  client.connect(PORT, '127.0.0.1', function() {
    client.write('Hello, server! Love, Client.');
  });

  client.on('data', function(data) {
    client.destroy();
    cb();
  });
}

module.exports = Helpers;
