#!/usr/bin/env node

"use strict";

const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const url = require("url");
const zlib = require("zlib");
const conf = {};

http.ServerResponse.prototype.serve = function serve (conf) {
	var gzip = zlib.createGzip();
	conf.message["content-encoding"] = "gzip";

	// we accept both streams and raw data
	this.writeHead(conf.code, conf.message, conf.headers);
	if (conf.data.constructor === fs.ReadStream) {
		conf.data.pipe(gzip).pipe(this);
	} else {
		gzip.end(conf.data);
		gzip.pipe(this);
	}
};

function escapeHTML (unsafe) {
	return unsafe
	.replace("&", "&amp;")
	.replace("<", "&lt;")
	.replace(">", "&gt;")
	.replace('"', "&quot;")
	.replace("'", "&#039;");
 }

class Render {
	static directory (pathname, files) {
		var head = `<head><meta charset='utf-8'><title>${pathname}</title></head>`;
		var list = "";
		var escapedfile = "";
		var link = "";
		for (var i = 0, len = files.length; i < len; i++) {
			link = encodeURI("/" + path.relative(conf.pwd, files[i]));
			escapedfile = escapeHTML(path.basename(files[i]));
			list += `<li><a href="${link}">${escapedfile}</a></li>`;
		}
		var body = `<body><h1>${pathname}</h1><ul>${list}</ul></body>`;
		return `<!DOCTYPE html><html>${head}${body}</html>`;
	}
}

class ResponseConf {
	static code (num, msg) {
		return {
			code: num,
			message: {"Content-type": "text/plain"},
			data: msg ? msg : "" + num
		};
	}

	static file (pathname) {
		return {
			code: 200,
			message: {
				"Content-type": "application/octet_stream",
			},
			data: fs.createReadStream(pathname),
		};
	}

	static directory (pathname) {
		var files = [];
		try {
			files = fs.readdirSync(pathname);
		} catch (err) {
			return ResponseConf.code(500);
		}
		for (var i = 0, len = files.length; i < len; i++) {
			files[i] = path.join(pathname, files[i]);
		}
		return {
			code: 200,
			message: {
				"Content-type": "text/html",
			},
			data: Render.directory(pathname, files),
		};
	}
}

class WebServer {
	constructor (port, hostname) {
		this.server = http.createServer(this.request_listener.bind(this));
		this.server.listen(port, hostname);
	}
	request_listener(req, res) {
		req.url = url.parse(req.url, true);
		var pathname = path.join(conf.pwd, decodeURI(req.url.pathname));
		fs.stat(pathname, function (err, stats) {
			if (err) {
				res.serve(ResponseConf.code(404));
			} else if (stats.isDirectory()) {
				res.serve(ResponseConf.directory(pathname));
			} else if (stats.isFile()) {
				res.serve(ResponseConf.file(pathname));
			} else {
				res.serve(ResponseConf.code(501));
			}
		});
	}
}

function sensible_ip() {
	var ifaces = os.networkInterfaces();
	for (var iface in ifaces) {
		if (!ifaces.hasOwnProperty(iface)) {
			continue;
		}
		iface = ifaces[iface];
		for (var i = 0; i < iface.length; i++) {
			if (iface[i].family === "IPv4" && iface[i].internal === false) {
				return iface[i].address;
			}
		}
	}
	return "localhost";
}

function configure() {
	conf.pwd = process.env.PWD ? process.env.PWD : process.exit();
	conf.host = sensible_ip();
	conf.port = 8000;
}

function main () {
	configure();
	console.log(`Server running at \x1B[94mhttp://${conf.host}:${conf.port}\x1B[0m`);
	new WebServer(conf.port, conf.ip);
}

main();
