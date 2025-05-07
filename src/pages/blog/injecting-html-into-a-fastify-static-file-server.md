---
layout: ../../layouts/PostLayout.astro
title: "Injecting HTML into a Fastify Static File Server"
pubDate: 2024-06-03T12:00:00-06:00
editDate: 2025-05-06T12:00:00-06:00
description: "Learn how to use a Node.js Buffers and Transform stream to automatically inject HTML content into a Fastify static file server responses."
---

Recently, I've been exploring how to build a live reload server from scratch. During this exploration, I had to figure out how to inject HTML into the payload of a [fastify](https://fastify.dev) static file server ([@fastify/static](https://github.com/fastify/fastify-static)) response. My solution utilizes the Node.js [Buffer](https://nodejs.org/api/buffer.html) API and a custom Node.js [Transform](https://nodejs.org/api/stream.html#class-streamtransform) stream. Let's dive in!

> [!NOTE]
> The source code is available [here](https://github.com/Ethan-Arrowood/fastify-inject-html-example).

To get started, import the necessary dependencies and instantiate the fastify server.

```js
import fastify from "fastify";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import stream from "node:stream";

const server = fastify({ logger: true });

server.register(fastifyStatic, {
  root: path.join(import.meta.dirname, "site"),
});

// Insert the remaining code here, before the `.listen()` call

server.listen({
  port: 3000,
  listenTextResolver: function listenTextResolver(address) {
    return `Server listening at ${address}`;
  },
});
```

Next, create some necessary constants.

```js
const ENCODED_CLOSING_HTML_TAG = new Uint8Array([
  60, 47, 104, 116, 109, 108, 62,
]);

const INJECT_CODE = fs.readFileSync(
  path.join(import.meta.dirname, "inject.html"),
);
```

The `ENCODED_CLOSING_HTML_TAG` is the encoded string `'</html>'`. You can generate this for yourself using: `new TextEncoder().encode('</html>')`. The `INJECT_CODE` variable is a Node.js Buffer since no encoding was passed to `fs.readFileSync()`.

> [!TIP]
> **What is a Node.js Buffer?**
>
> A `Buffer` represents a fixed-length sequence of bytes. It is one of the simplest data structures in a Node.js application. Uniquely, it is a subclass of the JavaScript primitive data type [Uint8Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array).

Create `inject.html` with the content:

```html
<script>
  alert("Injected!");
</script>
```

Now, for the heart of the solution, create an [onSend hook](https://fastify.dev/docs/latest/Reference/Hooks/#onsend). By default, the hook should pass through the `payload`.

```js
server.addHook("onSend", function onSendHook(request, reply, payload, done) {
  return done(null, payload);
});
```

Next, add a filter for HTML replies. A reliable way to achieve this is by inspecting the [content-type](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Type) header.

```js
server.addHook("onSend", function onSendHook(request, reply, payload, done) {
  if (reply.getHeader("content-type").startsWith("text/html")) {
  }
  return done(null, payload);
});
```

Before modifying the payload itself, set the appropriate [content-length](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Length) header. It is imperative that this value reflects the length of `payload`, otherwise most clients will not read the entire payload.

```js
server.addHook("onSend", function onSendHook(request, reply, payload, done) {
  if (reply.getHeader("content-type").startsWith("text/html")) {
    const contentLength = reply.getHeader("content-length");
    reply.header("content-length", contentLength + INJECT_CODE.length);
  }
  return done(null, payload);
});
```

Then, pipe the `payload` through a custom Transform stream. By default, the `transform()` method should pass through the `chunk`.

```js
server.addHook("onSend", function onSendHook(request, reply, payload, done) {
  if (reply.getHeader("content-type").startsWith("text/html")) {
    const contentLength = reply.getHeader("content-length");
    reply.header("content-length", contentLength + INJECT_CODE.length);

    const transformedPayload = payload.pipe(
      new stream.Transform({
        transform(chunk, encoding, callback) {
          return callback(null, chunk);
        },
      }),
    );

    return done(null, transformedPayload);
  }
  return done(null, payload);
});
```

> [!TIP]
> **What is a Transform stream?**
>
> If you're more familiar with Web Streams, a Node.js `Transform` is similar to a Web [TransformStream](https://developer.mozilla.org/en-US/docs/Web/API/TransformStream). The implementations are quite different, but they serve a similar purpose. Essentially, it is a streaming data structure that can be both written to and read from, while simultaneously modifying the data passing through it.

Finally, add an `encoding` check and then the buffer injection logic.

```js
server.addHook("onSend", function onSendHook(request, reply, payload, done) {
  if (reply.getHeader("content-type").startsWith("text/html")) {
    const contentLength = reply.getHeader("content-length");
    reply.header("content-length", contentLength + INJECT_CODE.length);

    const transformedPayload = payload.pipe(
      new stream.Transform({
        transform(chunk, encoding, callback) {
          if (encoding === "buffer") {
            const i = chunk.lastIndexOf(ENCODED_CLOSING_HTML_TAG);
            if (i > -1) {
              const injected = Buffer.alloc(chunk.length + INJECT_CODE.length);
              injected
                .fill(chunk.slice(0, i))
                .fill(INJECT_CODE, i)
                .fill(chunk.slice(i), i + INJECT_CODE.length);
              return callback(null, injected);
            }
          } else {
            console.warn(`Unexpected encoding type ${encoding}`);
          }

          return callback(null, chunk);
        },
      }),
    );

    return done(null, transformedPayload);
  }
  return done(null, payload);
});
```

The injection logic itself is nothing too special. It finds the last index of the closing HTML tag (`'</html>'`), and then injects `INJECT_CODE` immediately before it by creating a new `Buffer` instance and filling it with the appropriate slices.

> [!TIP]
> A better way to inject HTML is to use a HTML parsing library such as [node-html-parser](https://www.npmjs.com/package/node-html-parser). It enables you to more precisely manipulate the HTML through APIs such as `htmlElement.insertAdjacentHTML("beforeend", /* inject code */);`.

Before wrapping up, it is important to highlight the potential security vulnerability of HTML injection. Do not inject non-sanitized input from users, and be extra careful when doing something like this in a production application. A small bug could lead to major headaches. This example was built as a simple, demonstration and a more robust solution should be considered before using it in production.

Finally, it is time to run the example!

Kick off the server using `node index.js`.

Navigate to `http://localhost:3000` in a browser, and you should see `Injected!` alerted to the screen 🎉
