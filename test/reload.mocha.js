const Nginx = require('..');
const needle = require('needle');
const pm2 = require('pm2');
const should = require('should');
const WS = require('ws');
const Helpers = require('./helpers.js');
const path = require('path');
const fs = require('fs');

describe('Reload', function() {
  it.skip('should re-configure nginx with Zero Downtime Reload (no failures at all)', function(done) {
    this.timeout(3000);

    Helpers.check_availability(1500, done);

    setTimeout(function() {
      client.call('addOrUpdateAppRouting', {
        app_name : 'app1',
        routing : {
          mode : 'http',
          in_port : 9001,
          out_ports : [10004, 10005]
        }
      }, function() {
      });
    }, 500);
  });

  it.skip('should frontal ip hit all new backends (10004, 10005)', function(done) {
    Helpers.multi_query(9001, [10004, 10005], done);
  });

});
