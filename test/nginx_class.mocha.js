
const Nginx = require('..');
const needle = require('needle');
const pm2 = require('pm2');
const should = require('should');
const WS = require('ws');
const Helpers = require('./helpers.js');
const path = require('path');
const fs = require('fs');

describe('Nginx Class', function() {
  var nginx;

  this.timeout(5000);

  describe('Base', function() {
    it('should instanciate class', function() {
      nginx = new Nginx({
        conf_file : path.join(__dirname, '../rd', 'nginx_controller'),
        pid : null,
        conf : null,
        debug_mode : false
      });
    });

    it('should find pid and configuration file', function(done) {
      nginx.init(done);
    });

    it('should have found pid and conf', function(done) {
      fs.statSync(nginx.conf);
      process.kill(nginx.pid, 0);
      done();
    });


    it('should reload nginx', function(done) {
      nginx.reload(() => {
        setTimeout(done, 100);
      });
    });
  });

});
