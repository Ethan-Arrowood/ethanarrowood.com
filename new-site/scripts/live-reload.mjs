import fs from "node:fs";
import path from "node:path";
import stream from "node:stream";
import { buildTailwindCSS } from "./build-tailwindcss.mjs";
import fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyWebsocket from "@fastify/websocket";
import fastifyPlugin from "fastify-plugin";
import Watcher from "watcher";

const LIVE_RELOAD_SCRIPT = fs.readFileSync(
	path.join(import.meta.dirname, "live-reload-script.html"),
);

const SITE_PATH = path.join(import.meta.dirname, "../site");

const ENCODED_CLOSING_HTML_TAG = new Uint8Array([
	60, 47, 104, 116, 109, 108, 62,
]);

const server = fastify({
	logger: {
		transport: {
			target: "pino-pretty",
			options: {
				colorize: true,
			},
		},
	},
});

server.register(fastifyStatic, {
	root: SITE_PATH,
});

server.addHook("onSend", function onSendHook(_, reply, payload, done) {
	// 304 Not Modified - don't do anything
	if (reply.statusCode === 304) return done(null, payload);

	if (reply.getHeader("content-type").startsWith("text/html")) {
		const contentLength = reply.getHeader("content-length");
		reply.header("content-length", contentLength + LIVE_RELOAD_SCRIPT.length);

		if (!(payload instanceof stream.Readable)) {
			console.warn(`Payload is not a Readable. Payload: ${payload}`);
			console.warn(`Reply:`, reply.getHeaders());
			console.warn(`Reply:`, reply.statusCode);
			return done(null, payload);
		}

		return done(
			null,
			payload.pipe(
				new stream.Transform({
					transform(chunk, encoding, callback) {
						if (encoding === "buffer") {
							const i = chunk.lastIndexOf(ENCODED_CLOSING_HTML_TAG);
							if (i > 0) {
								const injected = Buffer.alloc(
									chunk.length + LIVE_RELOAD_SCRIPT.length,
								);
								injected
									.fill(chunk.slice(0, i))
									.fill(LIVE_RELOAD_SCRIPT, i)
									.fill(chunk.slice(i), i + LIVE_RELOAD_SCRIPT.length);
								return callback(null, injected);
							}
						} else {
							console.warn(
								`Unexpected encoding type ${encoding}. Did not inject Live Reload Script.`,
							);
						}
						return callback(null, chunk);
					},
				}),
			),
		);
	}

	return done(null, payload);
});

server.register(fastifyWebsocket);

function fileWatcherDecorator(server, _, done) {
	const fileWatcher = new Watcher([SITE_PATH]);
	server.decorate("fileWatcher", fileWatcher);
	done(null);
}

server.register(fastifyPlugin(fileWatcherDecorator, { name: "fileWatcher" }));

function createSendLiveReloadMessageHandler(socket) {
	return function sendLiveReloadMessageHandler(filepath) {
		server.log.info(
			`📝 Change detected in ${path.relative(SITE_PATH, filepath)}`,
		);
		socket.send("reload");
	};
}

server.register(async function (server) {
	server.get("/ws", { websocket: true }, (socket, request) => {
		const changeHandler = createSendLiveReloadMessageHandler(socket);
		server.fileWatcher.addListener("change", changeHandler);
		socket.on("close", () => {
			server.fileWatcher.removeListener("change", changeHandler);
		});
	});
});

server.addHook("onListen", async function () {});

server.listen({
	port: 3000,
	listenTextResolver: function listenTextResolver(address) {
		return `Live Reload server listening at ${address}`;
	},
});
