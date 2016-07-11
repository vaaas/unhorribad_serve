#!/usr/bin/env node
// jshint esversion: 6
// jshint asi: true

"use strict"

const http = require("http")
const fs = require("fs")
const os = require("os")
const path = require("path")
const url = require("url")

function escapeHTML (unsafe) {
	return unsafe
		.replace("&", "&amp;")
		.replace("<", "&lt;")
		.replace(">", "&gt;")
		.replace('"', "&quot;")
		.replace("'", "&#039;")
 }

function render_directory (pathname, files) {
	const head = `<head><meta charset='utf-8'><title>${pathname}</title></head>`
	let list = ""
	let escapedfile = ""
	let link = ""
	for (let i = 0, len = files.length; i < len; i++) {
		link = encodeURI("/" + path.relative(".", files[i]))
		escapedfile = escapeHTML(path.basename(files[i]))
		list += `<li><a href="${link}">${escapedfile}</a></li>`
	}
	const body = `<body><h1>${pathname}</h1><ul>${list}</ul></body>`
	return `<!DOCTYPE html><html>${head}${body}</html>`
}

function ResponseConf (code, headers, data) {
	this.code = code
	this.headers = headers
	this.data = data
}

function stringify (string) {
	return `"${string.replace("\"", "\\\"")}"`
}

class Response {
	static code (num, msg) {
		return new ResponseConf(
			num,
			{"Content-Type": "text/plain"},
			msg ? msg : "" + num
		)
	}

	static file (pathname, size) {
		return new ResponseConf(
			200,
			{ 
				"Content-Type": "application/octet_stream",
				"Content-Disposition": `attachment; filename=${stringify(path.basename(pathname))};`,
				"Content-Length": size,
			},
			fs.createReadStream(pathname)
		)
	}

	static directory (pathname, files) {
		return new ResponseConf(
			200,
			{"Content-Type": "text/html"},
			render_directory(pathname, files)
		)
	}
}

function sensible_ip() {
	const ifaces = os.networkInterfaces()
	for (let iface in ifaces) {
		if (!ifaces.hasOwnProperty(iface)) continue
		iface = ifaces[iface]
		for (let i = 0; i < iface.length; i++)
			if (iface[i].family === "IPv4" && iface[i].internal === false)
				return iface[i].address
	}
	return "localhost"
}

function Server (port, host) {
	function serve (res, conf) {
		res.writeHead(conf.code, conf.headers)
		if (conf.data.constructor === fs.ReadStream) conf.data.pipe(res)
		else res.end(conf.data)
	}

	function request_listener(req, res) {
		req.url = url.parse(req.url, true)
		const pathname = path.join(".", decodeURI(req.url.pathname))
		fs.stat(pathname, (err, stats) => {
			if (err) {
				serve(res, Response.code(404))
			} else if (stats.isDirectory()) {
				request_directory(req, res, pathname)
			} else if (stats.isFile()) {
				serve(res, Response.file(pathname, stats.size))
			} else {
				serve(res, Response.code(501))
			}
		})
	}

	function request_directory (req, res, pathname) {
		fs.readdir(pathname, (err, files) => {
			if (err) {
				return serve(res, Response.code(500))
			}
			for (let i = 0, len = files.length; i < len; i++) {
				files[i] = path.join(pathname, files[i])
			}
			serve(res, Response.directory(pathname, files))
		})
	}

	const server = http.createServer(request_listener)
	server.listen(port, host)
}

function main () {
	const port = 8080
	const host = sensible_ip()
	Server(port, host)
	console.log(`Server running at \x1B[94mhttp://${host}:${port}\x1B[0m`)
}

main()
