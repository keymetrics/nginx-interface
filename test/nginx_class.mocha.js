
const Nginx = require('..');
const needle = require('needle');
const pm2 = require('pm2');
const should = require('should');
const Helpers = require('./helpers.js');
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
        namespace : 'pm2',
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

    it('should connect 9001 -> 10001', function(done) {
      client.call('addPortRouting', {
        app_name : 'app1',
        opts : {
          mode : 'http',
          in_port : 9001,
          out_port : 10001
        }
      }, (packet) => {
        should(packet.err).be.null();
        should(packet.data.http['app1'].instances.length).eql(1);
        setTimeout(done, 1000);
      });
    });

    it('should connect 9001 -> 10002', function(done) {
      client.call('addPortRouting', {
        app_name : 'app1',
        opts : {
          mode : 'http',
          in_port : 9001,
          out_port : 10002
        }
      }, (packet) => {
        should(packet.err).be.null();
        should(packet.data.http['app1'].instances.length).eql(2);
        setTimeout(done, 1000);
      });
    });

    it('should connect 9001 -> 10003', function(done) {
      client.call('addPortRouting', {
        app_name : 'app1',
        opts : {
          mode : 'http',
          in_port : 9001,
          out_port : 10003
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
      //console.log(conf_file);

      try {
        var err_file = fs.readFileSync('/var/log/nginx/error.log').toString();
      } catch(e) {
        var err_file = fs.readFileSync('/usr/local/var/log/nginx/error.log').toString();
      }
      //console.log(err_file);
      done();
    });

    it('should frontal ip hit all backends (10001, 10002, 10003)', function(done) {
      Helpers.multi_query(9001, [10001, 10002, 10003], done);
    });

    it('should delete 10001', function(done) {
      client.call('deletePortRouting', {
        app_name : 'app1',
        port : 10001
      }, function(packet) {
        should(packet.data.http['app1'].instances.length).eql(2);
        done();
      });
    });

    it('should delete 10002', function(done) {
      client.call('deletePortRouting', {
        app_name : 'app1',
        port : 10002
      }, function(packet) {
        should(packet.data.http['app1'].instances.length).eql(1);
        done();
      });
    });

    it('should delete 10003', function(done) {
      client.call('deletePortRouting', {
        app_name : 'app1',
        port : 10003
      }, function(packet) {
        should.not.exists(packet.data.http['app1']);
        done();
      });
    });

    it.skip('should request fail', function(done) {
      needle.get('http://localhost:9001', (err, res, body) => {
        should.exist(err);
        should(err.message).containEql('ECONNREFUSED');
        done();
      });
    });
  });
});
