
const fs = require('fs');
const ejs = require('ejs');
const path = require('path');
const needle = require('needle');
const tooling = require('./tooling.js');
const debug = require('debug')('nginx');
const findproc = require('find-process');

class Nginx {
  constructor(opts) {
    this.debug_mode = opts.debug_mode || false;
    this.conf = opts.conf;
    this.pid = opts.pid;
    this.status_port = opts.status_port || 49999;

    this.current_conf = {
      debug_mode : this.debug_mode,
      status_port : this.status_port,
      stream : {},
      http : {}
    };
  }

  init(cb) {
    if (this.pid == null) {
      this.findNginxPID((err, pid) => {
        if (err) {
          throw new Error(err);
        }
        this.pid = pid;

        if (this.conf == null) {
          this.findNginxConf((err, conf) => {
            this.conf = conf;
            cb();
          });
          return false;
        }
        return cb();
      });
    }
  }

  // Only look for default path
  // @todo add dynamic nginx.conf finder (locate like)
  findNginxConf(cb) {
    tooling.findConfigurationFile(cb);
  }

  startNginx(cb) {
    tooling.exec(`service nginx start`, cb);
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

  status(cb) {
    needle.get(`http://localhost:${this.status_port}/status`, (err, res, body) => {
      if (err) return cb(err);
      return cb(null, tooling.parseStub(body));
    });
  }

  reload(cb) {
    process.kill(this.pid, 'SIGHUP');
    cb();
  }

  updateConfiguration(cb) {
    ejs.renderFile(path.join(__dirname, './template.cfg'), this.current_conf, (err, cfg) => {
      if (err) {
        console.error(err);
        return cb ? cb(err) : null;
      }
      if (this.debug_mode)
        console.log(cfg);
      fs.writeFileSync(this.conf, cfg);
      return cb ? cb() : null;
    });
  }
}

module.exports = Nginx;
