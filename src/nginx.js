
const fs = require('fs');
const ejs = require('ejs');
const path = require('path');
const needle = require('needle');
const tooling = require('./tooling.js');
const debug = require('debug')('nginx');
const EventEmitter = require('events');
const findproc = require('find-process');
const hasbin = require('hasbin');
const async = require('async');

class NginxController extends EventEmitter {
  constructor(opts) {
    super();
    this.debug_mode = opts.debug_mode || false;
    this.conf_file = opts.conf;
    this.pid = opts.pid;
    this.status_port = opts.status_port || 49999;

    this.nginx_status = null;

    this.current_conf = {
      debug_mode : this.debug_mode,
      status_port : this.status_port,
      stream : {},
      http : {}
    };
  }

  launchDiscovery() {
    var t = setInterval(() => {
      this.findNginxMeta();
    }, 1000);
    this.findNginxMeta();
  }

  findNginxMeta() {
    this.findNginxPID((err, pid) => {
      if (err) {
        this.nginx_status = 'nginx pid cannot be found = nginx seems offline';
        return this.emit('error', 'cannot find nginx pid');
      }

      this.nginx_status = null;
      this.pid = pid;

      if (this.conf_file == null) {
        this.findNginxConf((err, conf) => {
          if (err) {
            this.nginx_status = 'cannot find nginx.conf file';
            return this.emit('error', 'cannot find nginx.conf file');
          }

          this.nginx_status = null;
          this.conf_file = conf;

          this.emit('ready', {
            conf : this.conf_file,
            pid : this.pid
          });
        });

        return false;
      }

      this.emit('ready', {
        conf : this.conf_file,
        pid : this.pid
      });
    });
  }

  launchInterface() {
    var bus = require('spiderlink')('nginx-interface');
    var nginx = this;

    bus.expose('getStatus', function(data, reply) {
      nginx.getStatus(reply);
    });

    bus.expose('ping', function(data, reply) {
      reply('pong');
    });

    bus.expose('addOrUpdateAppRouting', function(data, reply) {
      var app_name = data.app_name;
      var routing = data.routing;

      nginx.addOrUpdateAppRouting(app_name, routing, function(err, data) {
        reply({
          data : data,
          err : err
        });
      });
    });

    bus.expose('deleteAppRouting', function(data, reply) {
      var app_name = data.app_name;

      nginx.deleteAppRouting(app_name, reply);
    });
  }

  // Only look for default path
  // @todo add dynamic nginx.conf finder (locate like)
  findNginxConf(cb) {
    async.eachSeries([
      '/etc/nginx/nginx.conf',
      '/usr/local/nginx/conf/nginx.conf',
      '/usr/local/etc/nginx/nginx.conf'
    ], function(path, next) {
      fs.stat(path, function(err) {
        if (err) return next();
        return next(path);
      });
    }, function(file) {
      if (file == null)
        return cb(new Error('Cannot nginx.conf file'));
      return cb(null, file);
    });
  }

  findNginxPID(cb) {
    findproc('name', 'nginx')
      .then(function(list) {
        var nginx_proc;

        list.forEach(function(l) {
          // Find root process
          if (l.ppid <= 1)
            nginx_proc = l;
        });

        if (!nginx_proc)
          return cb('Nginx is not online');

        return cb(null, nginx_proc.pid);
      })
      .catch((e) => {
        throw e;
      })
  }

  startNginx(cb) {
    hasbin('service', function(result) {
      if (result === false)
        tooling.exec(`service nginx start`, cb);
    });
  }

  /**
   * @param Integer in_port   listening port
   * @param Array   out_ports fwd ports
   */
  addOrUpdateAppRouting(app_name, routing, cb = () => {}) {
    var lb_mode = routing.lb_mode || 'round_robin';
    var in_port = routing.in_port;
    var new_out_ports = routing.out_ports;
    var proxy_mode = routing.mode || 'stream';

    if (Array.isArray(new_out_ports)) {
      var p = [];
      new_out_ports.forEach((port) => {
        p.push({
          port : port
        })
      });
      new_out_ports = p;
    }

    /**
     * Set previous applications as backup (enforced reload)
     */
    if (this.current_conf[proxy_mode][app_name]) {
      var previous_port = this.current_conf[proxy_mode][app_name];

      previous_port.instances.forEach(function(old_instance, i) {
        new_out_ports.forEach(function(new_instance) {
          if (old_instance.port == new_instance.port) {
            var str = 'Binding same port (previous ' + old_instance.port + ', new ' + new_instance.port + ' for app ' + app_name + ')'
            throw new Error(str);
          }
        });

        if (!old_instance.backup) {
          new_out_ports.push({
            port : old_instance.port,
            backup : true
          });
        }
      });
    }

    this.current_conf[proxy_mode][app_name] = {
      port : in_port,
      instances : new_out_ports,
      balance : lb_mode
    };

    this.updateConfiguration((err) => {
      if (err) return cb(err);
      this.reload(cb);
    });
  }

  deleteAppRouting(app_name, cb = () => {}) {
    delete this.current_conf.stream[app_name];
    delete this.current_conf.http[app_name];
    this.updateConfiguration((err) => {
      if (err) return cb(err);
      this.reload(cb);
    });
  }

  getStatus(cb) {
    needle.get(`http://localhost:${this.status_port}/status`, (err, res, body) => {
      if (err) return cb(err);
      return cb(null, tooling.parseStub(body));
    });
  }

  reload(cb) {
    try {
      process.kill(this.pid, 'SIGHUP');
    } catch(e) {
      return cb(e);
    }

    process.nextTick(() => {
      return cb(null, this.current_conf);
    });
  }

  updateConfiguration(cb) {
    ejs.renderFile(path.join(__dirname, './template.cfg'), this.current_conf, (err, cfg) => {
      if (err) {
        console.error(err);
        return cb ? cb(err) : null;
      }
      if (this.debug_mode)
        console.log(cfg);
      fs.writeFile(this.conf_file, cfg, (err) => {
        if (err) {
          console.error(err);
          return cb ? cb(err) : null;
        }
        return cb ? cb(null, this.current_conf) : null;
      });
    });
  }
}

module.exports = NginxController;
