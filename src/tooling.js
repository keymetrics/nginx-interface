const activeRegex = /^Active connections:\s+(\d+)/;
const readingWritingRegex = /^Reading:\s+(\d+).*Writing:\s+(\d+).*Waiting:\s+(\d+)/;
const handledRegex = /^\s+(\d+)\s+(\d+)\s+(\d+)/;
const spawn = require('child_process').spawn;
const async = require('async');
const fs = require('fs');

exports.findConfigurationFile = function(cb) {
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
    return cb(null, file);
  });
}

exports.exec = function(command, cb) {
  var cmd = command.split(' ');
  var bin = cmd.shift();

  var install_instance = spawn(bin, cmd, {
    stdio : 'inherit',
    env: process.env,
		shell : true
  });

  install_instance.on('close', cb);

  install_instance.on('error', function (err) {
    console.error(err.stack || err);
  });
}

exports.parseStub = function(nginxStr) {
	var result = {};
	var lines = nginxStr.split(/\n/);
	lines.forEach(function(line) {
		var matches;
		if (activeRegex.test(line)) {
			matches = activeRegex.exec(line);
			result.active = matches[1];
		} else if (readingWritingRegex.test(line)) {
			matches = readingWritingRegex.exec(line);
			result.reading = matches[1];
			result.writing = matches[2];
			result.waiting = matches[3];
		} else if (handledRegex.test(line)) {
			matches = handledRegex.exec(line);
			result.accepted = matches[1];
			result.handled = matches[2];
			result.handles = matches[3];
		}
	});
	return result;
}
