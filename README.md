
# nginx-agent

This module allows to easily interact and re-configure NGINX on the fly.
Communicating with this agent require spiderlink communication.

## API

```javascript
var client = require('spiderlink')('pm2');

client.call('addPortRouting', {
  app_name : 'http-api',
  opts : {
    mode : 'http',
    in_port : 80,
    out_port : 10001
  }
}, function(packet) {
  if (packet.err) console.error(packet.err);
  console.log(packet.data);
});

client.call('deletePortRouting', {
  app_name : 'http-api',
  port : 9001
} [...]);
```

## Test

```
$ sudo npm test
```

## Run

```
$ sudo node index.js
```

## Build NGINX

Activate the TCP forwarding with the `--with-stream` option.

```
$ ./configure --with-stream --with-http_stub_status_module --with-http_ssl_module
$ make
$ cp objs/nginx .
$ ./nginx -v
```

Extra options: http://nginx.org/en/docs/configure.html
Full install: https://gist.github.com/tollmanz/8662688

Start nginx:

```
$ ./nginx -p . -c nginx.conf
```

Nginx vs Haproxy vs PM2 cluster
https://gist.github.com/Unitech/4be07d1dd815afce793b6ab60949c167

## Template data

```
 {
   status_port : this.status_port,
   stream : {
     'app1' : {
       port : 7000,
       balance : 'roundrobin',
       instances : [{
         port : 9010
       }, {
         port : 9011
       }, {
         port : 9012
       }]
     }
   },
   http : {
     'app2' : {
       port : 7000,
       balance : 'roundrobin',
       instances : [{
         port : 9010
       }, {
         port : 9011
       }, {
         port : 9012
       }]
     }
   }
 };
```

## Reality

- http/https application = layer 4 load balancing (fast) = round_robin, least_conn
- ws/http/https application = layer 7 load balancing (slow) = ip_hash
- node portfinder: https://github.com/indexzero/node-portfinder

## Doc

http://nginx.org/packages/

- Stream LB:
https://www.nginx.com/resources/admin-guide/tcp-load-balancing/
https://www.nginx.com/blog/tcp-load-balancing-with-nginx-1-9-0-and-nginx-plus-r6/

- Graceful reload:
http://openmymind.net/Framework-Agnostic-Zero-Downtime-Deployment-With-Nginx/
Express: res.set("Connection", "close");

## Parameters

The max_fails directive sets the number of consecutive unsuccessful attempts to communicate with the server that should happen during fail_timeout. By default, max_fails is set to 1. When it is set to 0, health checks are disabled for this server. The fail_timeout parameter also defines how long the server will be marked as failed. After fail_timeout interval following the server failure, nginx will start to gracefully probe the server with the live client’s requests. If the probes have been successful, the server is marked as a live one.

Further reading

In addition, there are more directives and parameters that control server load balancing in nginx, e.g. proxy_next_upstream, backup, down, and keepalive. For more information please check our reference documentation.
