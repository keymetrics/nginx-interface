

const Nginx = require('..');
const needle = require('needle');
const pm2 = require('pm2');
const should = require('should');
const WS = require('ws');
const Helpers = require('./helpers.js');
const path = require('path');

describe('Nginx Class', function() {
  var nginx;

  this.timeout(5000);

  before(function(done) {
    pm2.kill(done);
  });

  after(function(done) {
    nginx.stop(done);
  });

  describe('Base', function() {
    it('should instanciate class', function() {
      nginx = new Nginx({
        prefix : path.join(__dirname, '../rd', 'nginx_controller'),
        debug_mode : false
      });
    });

    it('should start nginx', function(done) {
      nginx.start(done);
    });

    it('should reload nginx', function(done) {
      nginx.reload(() => {
        setTimeout(done, 100);
      });
    });
  });

  describe('(STREAM) TCP connection', function() {

    after(function(done) {
      pm2.kill(done);
    });

    it('should start multiple apps', function(done) {
      pm2.start([{
        script : __dirname + '/fixtures/tcp.js',
        name : '10001',
        force : true,
        env : {
          PORT : 10001
        }
      },{
        script : __dirname + '/fixtures/tcp.js',
        name : '10002',
        force : true,
        env : {
          PORT : 10002
        }
      }], done);
    });

    it('should configure nginx', function(done) {
      nginx.addOrUpdateAppRouting('tcp', {
        mode : 'stream',
        in_port : 8888,
        out_ports : [10001, 10002]
      }, () => {
        setTimeout(done, 1000);
      });
    });

    it('should connect to TCP', function(done) {
      Helpers.connectTCP(8888, done);
    });

    it('should delete configuration', function(done) {
      nginx.deleteAppRouting('tcp', () => {
        setTimeout(done, 1000);
      });
    });

  });

  describe('(STREAM) HTTP Add/Update routing', function() {
    after(function(done) {
      pm2.kill(done);
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
      nginx.addOrUpdateAppRouting('app1', {
        mode : 'stream',
        in_port : 9001,
        out_ports : [10001, 10002, 10003]
      }, () => {
        setTimeout(done, 1000);
      });
    });

    it('should frontal ip hit all backends (10001, 10002, 10003)', function(done) {
      Helpers.multi_query([10001, 10002, 10003], done);
    });

    it('should re-configure nginx with Zero Downtime Reload (no failures at all)', function(done) {
      this.timeout(3000);

      Helpers.check_availability(1500, done);

      setTimeout(function() {
        nginx.addOrUpdateAppRouting('app1', {
          mode : 'stream',
          in_port :9001,
          out_ports : [10004, 10005]
        }, () => {
        });
      }, 500);
    });

    it('should frontal ip hit all new backends (10004, 10005)', function(done) {
      Helpers.multi_query([10004, 10005], done);
    });

    it('should delete configuration', function(done) {
      nginx.deleteAppRouting('app1', () => {
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

  describe('(HTTP) HTTP Add/Update routing', function() {
    after(function(done) {
      pm2.kill(done);
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
      nginx.addOrUpdateAppRouting('app1', {
        mode : 'http',
        in_port : 9001,
        out_ports : [10001, 10002, 10003]
      }, () => {
        setTimeout(done, 1000);
      });
    });

    it('should frontal ip hit all backends (10001, 10002, 10003)', function(done) {
      Helpers.multi_query([10001, 10002, 10003], done);
    });

    it('should re-configure nginx with Zero Downtime Reload (no failures at all)', function(done) {
      this.timeout(3000);

      Helpers.check_availability(1500, done);

      setTimeout(function() {
        nginx.addOrUpdateAppRouting('app1', {
          mode : 'http',
          in_port :9001,
          out_ports : [10004, 10005]
        }, () => {
        });
      }, 500);
    });

    it('should frontal ip hit all new backends (10004, 10005)', function(done) {
      Helpers.multi_query([10004, 10005], done);
    });

    it('should delete configuration', function(done) {
      nginx.deleteAppRouting('app1', () => {
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

  describe('(HTTP) Websocket with auto upgrade', function() {
    after(function(done) {
      pm2.kill(done);
    });

    it('should start multiple apps', function(done) {
      pm2.start([{
        script : __dirname + '/fixtures/auto-upgrade-websocket.js',
        name : '10001',
        force : true,
        env : {
          PORT : 10001
        }
      },{
        script : __dirname + '/fixtures/auto-upgrade-websocket.js',
        name : '10002',
        force : true,
        env : {
          PORT : 10002
        }
      }], done)
    });

    it('should configure nginx', function(done) {
      nginx.addOrUpdateAppRouting('app2', {
        mode : 'http',
        in_port : 9001,
        out_ports : [10001, 10002],
        lb_mode : 'ip_hash'
      }, () => {
        setTimeout(done, 1500);
      });
    });

    it('should successfully connect via WS', function(done) {
      Helpers.connectWS(9001, (err, msg) => {
        Helpers.connectWS(9001, (err, msg) => {
          should(err).be.null();
          // Sticky LB should always redirect to same app
          should(msg).eql('10001');
          done();
        });
      });
    });

    it('should delete configuration', function(done) {
      nginx.deleteAppRouting('app2', () => {
        setTimeout(done, 1000);
      });
    });

  });

  describe('(HTTP) Raw WS', function() {
    after(function(done) {
      pm2.kill(done);
    });

    it('should start multiple apps', function(done) {
      pm2.start([{
        script : __dirname + '/fixtures/ws.js',
        name : '10001',
        force : true,
        env : {
          PORT : 10001
        }
      },{
        script : __dirname + '/fixtures/ws.js',
        name : '10002',
        force : true,
        env : {
          PORT : 10002
        }
      }], done)
    });

    it('should configure nginx', function(done) {
      nginx.addOrUpdateAppRouting('app3', {
        mode : 'http',
        in_port : 9003,
        out_ports : [10001, 10002],
        lb_mode : 'ip_hash'
      }, () => {
        setTimeout(done, 1500);
      });
    });

    it('should successfully connect via WS', function(done) {
      const ws = new WS('ws://localhost:9003/', {
        perMessageDeflate: false
      });

      ws.on('message', (data) => {
        done();
      });
    });
  });

});
