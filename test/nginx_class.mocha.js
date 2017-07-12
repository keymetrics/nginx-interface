
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
  var client;
  var conf;

  this.timeout(5000);

  describe('Base', function() {
    it('should instanciate class', function() {
      nginx = new Nginx({
        pid : null,
        conf : null,
        debug_mode : false
      });
    });

    it('should find pid and configuration file', function(done) {
      nginx.launchDiscovery();
      nginx.once('ready', function(data) {
        should.exists(data.conf);
        should.exists(data.pid);
        done();
      });
    });

    it('should have found pid and conf', function(done) {
      fs.statSync(nginx.conf_file);
      process.kill(nginx.pid, 0);
      done();
    });

    it('should not fail when reloading nginx', function(done) {
      nginx.reload(() => {
        setTimeout(done, 100);
      });
    });

    it('should not fail when updating configuration', function(done) {
      nginx.updateConfiguration(function() {
        done();
      });
    });
  });

  describe('Interface', function() {
    it('should launch spiderlink server', function() {
      require('spiderlink')({
        server: true
      });
    });

    it('should launch nginx interface', function() {
      nginx.launchInterface();
    });

    it('should instanciate client', function() {
      client = require('spiderlink')({
        namespace : 'nginx-interface',
        forceNew : true
      });
    });

    it('should ping and get pong', function(done) {
      client.call('ping', function(res) {
        should(res).eql('pong');
        done();
      });
    });

    it('should get configuration', function(done) {
      client.call('getConfiguration', function(data) {
        conf = data;
        done();
      });
    });
  });

  describe('(HTTP) HTTP Add/Update routing', function() {
    before(function(done) {
      pm2.delete('all', function() { done() });
    });

    it('should start multiple apps', function(done) {
      pm2.start([{
        script : __dirname + '/fixtures/http.js',
        name : '10001',
        force : true,
        env : {
          PORT : 10001
        }
      },{
        script : __dirname + '/fixtures/http.js',
        name : '10002',
        force : true,
        env : {
          PORT : 10002
        }
      },{
        script : __dirname + '/fixtures/http.js',
        name : '10003',
        force : true,
        env : {
          PORT : 10003
        }
      },{
        script : __dirname + '/fixtures/http.js',
        name : '10004',
        force : true,
        env : {
          PORT : 10004
        }
      },{
        script : __dirname + '/fixtures/http.js',
        name : '10005',
        force : true,
        env : {
          PORT : 10005
        }
      }], done)
    });

    it('should configure nginx', function(done) {
      client.call('addOrUpdateAppRouting', {
        app_name : 'app1',
        routing : {
          mode : 'http',
          in_port : 9001,
          out_ports : [10001, 10002, 10003]
        }
      }, (packet) => {
        should(packet.err).be.null();
        should(packet.data.http['app1'].instances.length).eql(3);
        setTimeout(done, 1000);
      });
    });

    it('should have right config file', function(done) {
      console.log(`Reading ${conf.conf_file}`);
      var conf_file = fs.readFileSync(conf.conf_file).toString();
      console.log(conf_file);
      done();
    });

    it('should frontal ip hit all backends (10001, 10002, 10003)', function(done) {
      Helpers.multi_query(9001, [10001, 10002, 10003], done);
    });

    it('should re-configure nginx with Zero Downtime Reload (no failures at all)', function(done) {
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

    it('should frontal ip hit all new backends (10004, 10005)', function(done) {
      Helpers.multi_query(9001, [10004, 10005], done);
    });

    it('should delete configuration', function(done) {
      client.call('deleteAppRouting', {
        app_name : 'app1'
      }, () => {
        setTimeout(done, 1000);
      });
    });

    it('should request fail', function(done) {
      needle.get('http://localhost:9001', (err, res, body) => {
        should.exist(err);
        should(err.message).containEql('ECONNREFUSED');
        done();
      });
    });
  });
});
