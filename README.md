
# Nginx configuration on the fly

## Build

Options: http://nginx.org/en/docs/configure.html

```
$ ./configure --with-stream --with-http_stub_status_module --with-http_ssl_module
$ make
$ cp objs/nginx .
$ ./nginx -v
```

Full install: https://gist.github.com/tollmanz/8662688

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
