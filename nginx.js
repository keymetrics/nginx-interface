
const fs = require('fs');
const ejs = require('ejs');
const path = require('path');
const needle = require('needle');
const tooling = require('./tooling.js');

class Nginx {
  constructor(opts) {
    this.opts = Object.assign({
      prefix : '.',
      debug_mode : true
    }, opts);

    this.prefix = opts.prefix;
    this.conf = path.join(__dirname, this.prefix, 'nginx.conf');
    this.bin_path = path.join(__dirname, this.prefix, 'nginx');
    this.status_port = 49999;

    this.current_conf = {
      debug_mode : this.opts.debug_mode,
      status_port : this.status_port,
      stream : {},
      http : {}
    };
  }

  start(cb) {
    this.flushConfiguration();

    tooling.exec(`${this.bin_path} -p ${this.prefix} -c ${this.conf}`, () => {});

    setTimeout(cb, 500);

    process.on('SIGINT', () => {
      this.stop(() => {
        process.exit(0);
      });
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

    this.flushConfiguration((err) => {
      if (err) return cb(err);
      this.reload(cb);
    });
  }

  deleteAppRouting(app_name, cb = () => {}) {
    delete this.current_conf.stream[app_name];
    delete this.current_conf.http[app_name];
    this.flushConfiguration((err) => {
      if (err) return cb(err);
      this.reload(cb);
    });
  }

  status(cb) {
    needle.get('http://localhost:49999/status', (err, res, body) => {
      if (err) return cb(err);
      return cb(null, tooling.parseStub(body));
    });
  }

  stop(cb) {
    tooling.exec(`${this.bin_path} -p ${this.prefix} -c ${this.conf} -s stop`, cb);
  }

  reload(cb) {
    tooling.exec(`${this.bin_path} -p ${this.prefix} -c ${this.conf} -s reload`, cb);
  }

  flushConfiguration(cb) {
    ejs.renderFile('./template.cfg', this.current_conf, (err, cfg) => {
      if (err) {
        console.error(err);
        return cb ? cb(err) : null;
      }
      if (this.opts.debug_mode)
        console.log(cfg);
      fs.writeFileSync(this.conf, cfg);
      return cb ? cb() : null;
    });
  }
}

module.exports = Nginx;

// var nginx = new Nginx('nginx_controller');

// // nginx.addOrUpdateAppRouting('km', 9000, [10001, 10002, 10003]);
// // nginx.addOrUpdateAppRouting('km', 9000, [10004, 10005, 10006]);
// //nginx.addOrUpdateAppRouting('km', 9000, [10007, 10008]);
// //nginx.addOrUpdateAppRouting('km3', 9001, [20001, 20002, 20003]);

// var i = 10000, j = 10001, k = 10002;

// setInterval(() => {
//   if (k < 10010) {
//     nginx.addOrUpdateAppRouting('km', 9000, [i+=3, j+=3, k+=3]);

//     nginx.reload(() => {});
//   }
// }, 10000);

// nginx.start(() => {});
