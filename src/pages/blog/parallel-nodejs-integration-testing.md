---
layout: ../../layouts/PostLayout.astro
title: "Parallel Node.js Integration Testing: Processes, Ports, and Practical Defaults"
pubDate: 2026-10-22T12:00:00-06:00
editDate: 2026-10-22T12:00:00-06:00
description: "How I built Harper's integration testing framework around isolated processes, loopback addresses, and measured concurrency defaults. The same lifecycle API works with node:test and Playwright, locally and across CI shards."
---

When I started working on Harper's integration tests, running more tests at once was only part of the problem. Each test needed a real application, with its own database, files, configuration, and network listeners. Starting another process was easy. Making that process independent of every other test took more work.

I wanted a test I could run on my laptop, by itself, without reconstructing the state left behind by twenty other files. Then I wanted to run many of those tests at once, using the same setup in CI and in browser tests.

That became [`@harperfast/integration-testing`](https://github.com/HarperFast/integration-testing). This post follows my talk, [Performant, Parallelizable, Framework Agnostic Node.js Integration Testing](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing), with the implementation details and measurements behind it. The framework now runs thousands of tests across several runtime configurations. Stability remains unfinished work; the data at the end makes that clear.

## Testing a collapsed stack

[Harper](https://github.com/HarperFast/harper) puts the database, cache, networking, and application runtime into one Node.js process. It uses workers for parallel execution. Applications can include REST APIs, web frontends, messaging, storage, and plugins. Some tests need several Harper instances communicating with each other.

That changes what an integration test has to manage. A request can exercise the HTTP server, application code, and database together. A restart test has to stop the application, preserve its files, start it again, and check that the expected state survived. Mocking the database or calling an internal function would skip the behavior I wanted to test.

For this work, I define integration testing as testing the complete application through its public interfaces. I control requests, configuration, environment variables, CLI flags, stdin, and signals. I observe responses, logs, files, and exit codes. I don't reach into the running application's internals.

This gives me a useful boundary without requiring the full production deployment. A local application process can exercise real persistence and networking without provisioning a production cluster for every test.

## Application = process

Once I chose that boundary, most of the framework became process management. Start the application. Wait until it is ready. Interact with it. Restart it when the test requires that. Stop it and clean up.

Readiness matters here. A process existing doesn't mean its HTTP server is accepting requests. A fixed sleep has two failure modes: it wastes time when startup is fast, and it expires too early when startup is slow. The lifecycle needs to wait for the application to be usable.

The process also needs an isolated directory and network address. Otherwise, two correct tests can corrupt each other's data or compete for the same listener. Teardown has to release all of those resources, including when a test fails. Crash recovery matters because a developer can interrupt the runner before any cleanup hook executes.

I chose `node:test` early. It removed a dependency, gave me a straightforward process model, and let me use Node's own test runner API. I still wanted the lifecycle functions to work with other runners. Browser tests would need the same Harper instances, even if Playwright owned the test execution.

## Two different kinds of concurrency

The word "concurrency" describes two separate controls in `node:test`.

Runner concurrency controls how many test files execute in parallel. With the runner's process isolation, each file gets a separate process:

```bash
node --test \
  --test-concurrency=5 \
  "*.test.js"
```

See [`--test-concurrency`](https://nodejs.org/api/cli.html#--test-concurrency) in the Node.js CLI docs.

Suite concurrency controls asynchronous work inside a process. The deck uses this abbreviated example, with the test bodies omitted:

```javascript
suite('x', { concurrency: true }, () => {
  test('a', async () => { … });
  test('b', async () => { … });
});
```

See the [`concurrency` option for `suite()`](https://nodejs.org/api/test.html#suitename-options-fn) in the `node:test` docs.

Those tests can overlap while awaiting I/O. They still share a JavaScript process and whatever state the suite creates. Enabling suite concurrency doesn't give each test a separate application or make shared mutations safe.

File-level parallelism was the useful starting point for Harper. A file could own its application instances and temporary data. Other files could run beside it without depending on its setup or teardown. Within a file, tests could share an instance when that was intentional.

But five test files can mean five test processes plus five application processes. Those applications may create workers or more processes. The runner's concurrency setting counts files, so it doesn't describe the total work competing for CPU.

### Measuring the useful limit

My laptop reported 12 through `os.availableParallelism()`. Running twelve application-heavy test files at once sounded expensive, but simply dividing by two was still a guess. Processes spend time waiting for I/O, and the operating system can schedule other work during those waits.

I built a [parallelization experiment](https://github.com/Ethan-Arrowood/node-test-runner-parallelization-analysis) with 20 generated test files. Each started an application process. Work varied within a mode, covering 0 to 100 MB of file I/O, 0 to 3 processes, and 0 to 4 worker threads. I tested concurrency levels from 1 through 12, with 25 samples per level on a normal developer laptop.

Here are the median total suite durations:

| Concurrency | Median duration (ms) |
| ----------- | -------------------- |
| 1           | 9,939                |
| 2           | 5,776                |
| 3           | 4,582                |
| 4           | 3,904                |
| 5           | 3,759                |
| 6           | 3,597                |
| 7           | 3,468                |
| 8           | 3,671                |
| 9           | 3,601                |
| 10          | 3,534                |
| 11          | 3,724                |
| 12          | 3,952                |

The first few increases helped a lot. After that, the gains narrowed. Seven was the measured optimum. Twelve took longer than four despite allowing three times as many files to execute at once.

The median wasn't the whole story:

| Concurrency | Median (ms) | Standard deviation (ms) | p95 (ms) | Worst run (ms) |
| --- | --- | --- | --- | --- |
| 4 | 3,904 | 368 | 4,648 | 5,238 |
| 7 | 3,468 | 294 | 3,990 | 4,520 |
| 10 | 3,534 | 654 | 5,339 | 5,466 |
| 11 | 3,724 | 690 | 5,096 | 5,717 |

Ten looked close to seven at the median, but its standard deviation more than doubled, from 294 ms to 654 ms. At eleven, it reached 690 ms. The p95 at ten was 5,339 ms, compared with 3,990 ms at seven. It was also much slower than a typical run at four, which took 3,904 ms.

That spread matters when waiting for a test result. A setting that occasionally finishes quickly but has a much longer tail is a poor default for repeated local runs. More processes were buying contention instead of useful throughput.

The default I shipped was `floor(availableParallelism / 2) + 1`: half the available parallelism, rounded down, plus one. The calculation from the deck is:

```plain-text
concurrency = floor(availableParallelism / 2) + 1
            = floor(12 / 2) + 1
            = 7   // the measured optimum
```

The shipped default is one line in the runner, [`src/run.ts`](https://github.com/HarperFast/integration-testing/blob/c20f0a3d182c6756c90f84fe77804da91f4ae416/src/run.ts#L53-L57). It still accepts `--concurrency` or `HARPER_INTEGRATION_TEST_CONCURRENCY` to override it.

On a four-vCPU runner, that gives three concurrent files. This is a configurable starting point based on the experiment, not a universal optimum. A file that starts four cluster nodes has a different resource profile from one that makes a few HTTP requests.

## Everything wants port 9925

Once files could run in parallel, they immediately competed for Harper's default ports. Every instance wanted its operations API on port 9925, its HTTP server on 9926, and MQTT on 1883 and 8883. With TLS configured, HTTPS adds 9927.

Letting the operating system choose an available port is easy when the server supports it:

```javascript
server.listen(0, () => {
  const { port } = server.address();   // the OS picked a free one
});
```

The application then has to report that port to the test. Harper required ports to be configured, and I wanted to solve this in the test framework without changing core. Multiple listeners also meant coordinating more than one number.

### Why get-port doesn't reserve a port

A helper such as `get-port` can find a free port before starting the application. The problem is the gap between finding it and using it. This is the simplified sequence from the deck, with `listen` and `close` standing in for async helpers:

```javascript
// what get-port does, roughly:
async function getPort() {
  const server = net.createServer();
  await listen(server, 0);          // OS assigns a free port
  const { port } = server.address();
  await close(server);              // ← the port is released here
  return port;
}

const port = await getPort();
const harper = await createHarper(port);   // ← nothing reserved it in between
```

This is a simplified version of the approach the [`get-port`](https://github.com/sindresorhus/get-port) package takes.

After the temporary server closes, another process can acquire that port. Starting Harper with the returned number doesn't transfer ownership of the temporary socket. With many tests starting at once, there are more opportunities for that race.

### Give each instance a loopback address

Instead of changing every port, I assigned each instance a different loopback address. The IPv4 loopback block is `127.0.0.0/8`, giving us many local addresses beyond the familiar `127.0.0.1`.

```plain-text
test/application 1 → http://127.0.0.2:9925
test/application 2 → http://127.0.0.3:9925
test/application 3 → http://127.0.0.4:9925
```

Today the harness binds five ports per node: operations, HTTP, HTTPS, and two for MQTT. You can see the [port constants](https://github.com/HarperFast/integration-testing/blob/c20f0a3d182c6756c90f84fe77804da91f4ae416/src/harperLifecycle.ts#L52-L61) and the [address-qualified arguments](https://github.com/HarperFast/integration-testing/blob/c20f0a3d182c6756c90f84fe77804da91f4ae416/src/harperLifecycle.ts#L703-L722) it passes to Harper.

Each instance keeps its default ports and binds them to its assigned address. The harness passes each port with its address, as in `--HTTP_PORT=127.0.0.2:9926`. The address separates the listeners. This depends on every listener binding that specific address; a process listening on all interfaces is a separate problem, covered below.

Platform setup is part of the design. Linux and Windows route all of `127.0.0.0/8` to loopback by default. macOS only enables `127.0.0.1`, so each additional address has to be added as an alias on `lo0`. The package ships a script that does it:

```bash
# once per boot, or install the provided launchd daemon
npx harper-integration-test-setup-loopback

# what it runs for each address in the pool
sudo ifconfig lo0 alias 127.0.0.2 netmask 255.255.255.255 up
```

The full script is [`scripts/setup-loopback.sh`](https://github.com/HarperFast/integration-testing/blob/c20f0a3d182c6756c90f84fe77804da91f4ae416/scripts/setup-loopback.sh), and the boot-time daemon is [`scripts/io.harperdb.loopback-setup.plist`](https://github.com/HarperFast/integration-testing/blob/c20f0a3d182c6756c90f84fe77804da91f4ae416/scripts/io.harperdb.loopback-setup.plist).

It configures 32 addresses by default, `127.0.0.2` through `127.0.0.33`, and verifies each one landed. macOS drops these aliases on every reboot, so the package also includes a `launchd` daemon that reruns the script at boot.

### Why the netmask matters

The first version of the script left out the netmask. macOS then gives each alias `255.0.0.0`, so every alias claims the entire `127.0.0.0/8` network. With a large pool, hundreds of interface addresses assert the same subnet. `mDNSResponder` treats that as an address conflict and answers with a storm of announcements on port 5353. With 254 aliases on `/8`, it held about 65% of a CPU core. With `/32`, each alias is an isolated host, and the same 254 aliases cost about 0%. Kris found and fixed this in [integration-testing #21](https://github.com/HarperFast/integration-testing/pull/21), which has the measurements.

The framework checks that the configured addresses are usable. A missing setup step should fail before hundreds of application startups produce confusing network errors.

## Coordinating the address pool

Separate test processes need shared allocation state. An array in a JavaScript module won't work because every process gets its own copy.

The pool uses a JSON file containing an array of process IDs:

```json
[42, 43, null, 45, null, null]
```

The allocator, including a comment that walks through this array, is [`getNextAvailableLoopbackAddress()`](https://github.com/HarperFast/integration-testing/blob/c20f0a3d182c6756c90f84fe77804da91f4ae416/src/loopbackAddressPool.ts#L512-L638).

Index zero represents `127.0.0.2`, index one represents `127.0.0.3`, and so on. A test runner's PID marks ownership; `null` marks a free slot. Allocation takes the first available slot. Teardown releases it once the node's ports are free.

### Lock the read-modify-write operation

Two processes must not read the same free slot and both claim it. The pool needs a cross-process mutex around reading, modifying, and writing the allocation file.

The file-lock primitive is small:

```javascript
const handle = await open(LOCK_PATH, 'wx');
await handle.writeFile(token);
await handle.close();
```

The real version is [`acquireLock()`](https://github.com/HarperFast/integration-testing/blob/c20f0a3d182c6756c90f84fe77804da91f4ae416/src/loopbackAddressPool.ts#L165-L199), including the stale-lock check.

The `wx` flag creates the file exclusively. If it already exists, the open fails. That atomic creation decides which process holds the lock. Closing the handle doesn't remove the lock file; the file remains until the holder releases the lock after updating the pool.

A daemon or orchestrator could coordinate allocation too. A file lock was enough for this local shared resource. It also needed a stale-lock timeout so a crashed process couldn't block all future allocations. The timeout is 10 seconds.

### A slow writer can lose the lock

The stale timeout creates its own problem. If a holder stalls past 10 seconds, another process treats its lock as stale and takes over. When the first process wakes up, it still believes it holds the lock and writes its old view of the pool over the new claim.

That's what the token is for. It combines the PID, a counter, and random bytes. Before publishing, the writer checks that the lock file still holds its token:

```javascript
await writeFile(pendingPath, JSON.stringify(pool));
await assertLockHeld(token);          // still ours?
await rename(pendingPath, POOL_PATH); // atomic publish
```

This is the core of [`writePoolFile()`](https://github.com/HarperFast/integration-testing/blob/c20f0a3d182c6756c90f84fe77804da91f4ae416/src/loopbackAddressPool.ts#L317-L339). The atomic write landed in [integration-testing #32](https://github.com/HarperFast/integration-testing/pull/32) and the token check in [#33](https://github.com/HarperFast/integration-testing/pull/33).

The pool is written to a temporary file and published with a rename, so readers see either the old file or the new one, never a torn write. If the token check fails, the operation retries from the current pool state. The check narrows the race; it doesn't close it completely. A pool file that can't be parsed is quarantined for six minutes before it's reset, so reservations whose nodes haven't bound yet aren't wiped.

### Reclaim crashed owners and verify addresses

Normal teardown isn't sufficient. Interrupting the runner can leave PIDs in the pool after their processes have exited.

The pool checks ownership with `process.kill(pid, 0)`. Signal zero checks whether the process exists without sending a terminating signal. When the pool is full, dead owners have their slots reclaimed before the allocator waits for a free one. The deck abbreviates this as a try/catch; when adapting the pattern, distinguish a missing process from a permission error. Failure to check a PID doesn't always mean it is dead.

The pool only tracks test runners. A runner killed with `SIGKILL`, or a cancelled CI job, could still leave Harper itself running and holding its fixed ports. Each Harper instance now starts in its own process group and registers itself in a [shared registry](https://github.com/HarperFast/integration-testing/blob/c20f0a3d182c6756c90f84fe77804da91f4ae416/src/harperInstanceRegistry.ts), added in [integration-testing #30](https://github.com/HarperFast/integration-testing/pull/30). A single monitor per user reaps the groups whose runner died. That relies on process groups, so it is POSIX only; on Windows the runner's own cleanup handlers are the only protection.

Allocation also doesn't prove that the operating system will accept the address. The framework verifies the pool at startup and checks again when allocating. The deck's address probe binds a temporary server:

```javascript
// bind to port 0 just to prove the address exists
server.listen(0, loopbackAddress, () => {
  server.close(() => resolve(loopbackAddress));
});
```

See [`validateLoopbackAddress()`](https://github.com/HarperFast/integration-testing/blob/c20f0a3d182c6756c90f84fe77804da91f4ae416/src/loopbackAddressPool.ts#L378-L392), and the [startup check](https://github.com/HarperFast/integration-testing/blob/c20f0a3d182c6756c90f84fe77804da91f4ae416/src/run.ts#L74-L89) in the runner that validates the whole pool before any test starts.

This answers whether the address is usable. It doesn't say whether anything already holds Harper's fixed ports there. The shared pool keeps cooperating test processes from choosing the same address at the same time. Two more checks run before an address is handed out.

### A dying node can still hold the address

Harper's HTTP workers bind their port with `SO_REUSEPORT`. That option lets several sockets share one address and port. The common failure looked like this: a test killed its node, the main thread exited and freed 9925, but the HTTP workers lingered on 9926. Teardown released the address, the next suite claimed it, and its new node silently co-bound 9926 beside the old workers. Connections were split between two nodes, and both suites failed in confusing ways.

The fix is a conflict canary. Before returning an address, the pool tries an exclusive bind on the operations and HTTP ports:

```javascript
// an exclusive bind fails with EADDRINUSE, even beside an SO_REUSEPORT socket
for (const port of [9925, 9926]) {
  if (await isPortInUseOnAddress(port, address)) skip(address);
}
```

The canary is [`isPortInUseOnAddress()`](https://github.com/HarperFast/integration-testing/blob/c20f0a3d182c6756c90f84fe77804da91f4ae416/src/loopbackAddressPool.ts#L403-L425) and [`findConflictingPort()`](https://github.com/HarperFast/integration-testing/blob/c20f0a3d182c6756c90f84fe77804da91f4ae416/src/loopbackAddressPool.ts#L442-L449). It landed in [integration-testing #17](https://github.com/HarperFast/integration-testing/pull/17), and [#20](https://github.com/HarperFast/integration-testing/pull/20) added the HTTP port.

Node's `net` server doesn't set `SO_REUSEPORT`, and Linux refuses to mix a reuse-port socket with a plain one on the same address and port. A held port means a node still owns the address. The pool releases it, skips it for this attempt, and probes it again later. macOS handles `SO_REUSEPORT` differently, but it doesn't show the silent co-bind, and CI runs on Linux.

Teardown closes the same gap from the other side. [`teardownHarper`](https://github.com/HarperFast/integration-testing/blob/c20f0a3d182c6756c90f84fe77804da91f4ae416/src/harperLifecycle.ts#L1091-L1133) uses [`waitForPortsFree()`](https://github.com/HarperFast/integration-testing/blob/c20f0a3d182c6756c90f84fe77804da91f4ae416/src/portUtils.ts#L90-L103) to wait up to five seconds for all of the node's ports to be free. Only then does it release the address and remove the directory. If a port stays held, it keeps both, and the slot is reclaimed when the runner exits.

### Some listeners cover every address

A process listening on `0.0.0.0:9926` overlaps every address in the pool. A local Harper running with its default configuration is the usual one. On macOS and Windows, an exclusive bind on `127.0.0.2:9926` succeeds beside it, so the canary can't see it. That process then receives a node's connections whenever the node has no listener of its own: while it starts, while its HTTP workers restart, and after teardown. Keep-alive connections stay with it, so a suite fails, or passes, against the wrong server.

On those platforms the pool connects to the ports instead of binding them:

```javascript
// an exclusive bind succeeds beside it there, so connect instead
const port = await findAcceptingPort(address, [9925, 9926]);
if (port) throw new ForeignListenerError(address, port);
```

See [`findAcceptingPort()`](https://github.com/HarperFast/integration-testing/blob/c20f0a3d182c6756c90f84fe77804da91f4ae416/src/portUtils.ts#L67-L75) and [where the allocator uses it](https://github.com/HarperFast/integration-testing/blob/c20f0a3d182c6756c90f84fe77804da91f4ae416/src/loopbackAddressPool.ts#L587-L621). The check landed in [integration-testing #40](https://github.com/HarperFast/integration-testing/pull/40).

The error names the port, so the fix is to stop that process or bind it to a specific address. Setting `HARPER_INTEGRATION_TEST_ALLOW_FOREIGN_LISTENERS=1` turns the error into a warning. Linux refuses the exclusive bind on its own, so it skips this probe.

## A lifecycle API that works with different runners

With allocation and process management in place, the public API could stay small. Starting an instance takes a context object:

```javascript
// ctx is a general options object

await startHarper(ctx);
// 1. create a temporary install directory
// 2. allocate a loopback address from the pool
// 3. spawn Harper, wait until it is actually ready
// 4. populate ctx.harper
```

The implementation is [`launchHarper()`](https://github.com/HarperFast/integration-testing/blob/c20f0a3d182c6756c90f84fe77804da91f4ae416/src/harperLifecycle.ts#L662-L755), which both `startHarper()` and `setupHarperWithFixture()` call.

The resulting `ctx.harper` exposes the resources the test needs. It's a `HarperContext`:

```typescript
interface HarperContext {
  httpURL: string;            // 'http://127.0.0.3:9926'
  operationsAPIURL: string;   // 'http://127.0.0.3:9925'
  hostname: string;           // '127.0.0.3'
  dataRootDir: string;        // '/tmp/harper-integration-test-Xk3pQz'
  admin: { username: string; password: string };
  process: ChildProcess;
  logDir?: string;
  startupOutput?: { stdout: string; stderr: string };
}
```

This is the [exported interface](https://github.com/HarperFast/integration-testing/blob/c20f0a3d182c6756c90f84fe77804da91f4ae416/src/harperLifecycle.ts#L199-L221), shown here without its doc comments.

`logDir` is set only when `HARPER_INTEGRATION_TEST_LOG_DIR` is configured. `startupOutput` holds Harper's stdout and stderr up to the point it reported ready.

If `ctx.harper` already names a `dataRootDir` and `hostname`, `startHarper` reuses them. That's how a test restarts the same node.

`teardownHarper(ctx)` stops Harper's whole process group, waits for its ports to be free, then releases the address and removes the temporary directory. `killHarper(ctx)` supports stopping the process separately from full teardown. `setupHarperWithFixture(ctx, fixturePath, options)` prepares an application fixture, and `createHarperContext(name)` creates a context for runners that don't already provide a suitable object.

The lifecycle API imports nothing from a test runner. It accepts an object with an optional `name` and a `harper` property it can populate. A `node:test` context and a plain object can both satisfy that contract.

### node:test hooks

Here is the deck's suite example, with imports omitted:

```typescript
suite('install', (ctx: ContextWithHarper) => {
  before(async () => {
    await startHarper(ctx);
  });
  after(async () => {
    await teardownHarper(ctx);
  });

  test('serves', async () => {
    const res = await fetch(ctx.harper.httpURL);
    strictEqual(res.status, 200);
  });
});
```

For a full test in Harper's own suite, see [`integrationTests/deploy/deploy-from-source.test.ts`](https://github.com/HarperFast/harper/blob/b1fb0c97649ffeb4b85e349d3db7f571bb7392a8/integrationTests/deploy/deploy-from-source.test.ts#L17-L164).

The suite owns the instance. Its tests interact with a real HTTP endpoint, and the cleanup hook owns teardown. Another file can use the same pattern with a different directory and address.

The package includes a convenience runner that configures the concurrency default, but that runner holds no required lifecycle state. A file still works under plain `node --test`. Running one test locally shouldn't require reproducing the entire CI entry point.

### Playwright fixtures

Playwright owns execution differently. A worker-scoped fixture gives each worker an application lifecycle. This is the adapter from the deck; `fixturePath` and `getHarperBinPath` come from the surrounding fixture setup:

```typescript
export function makeHarperFixture(fixtureName: string) {
  return async ({}, use) => {
    const ctx = createHarperContext(fixtureName);
    const started = await setupHarperWithFixture(ctx, fixturePath, {
      harperBinPath: getHarperBinPath(),
      startupTimeoutMs: 120_000,   // a Next.js build is slow
    });

    await use(started.harper);

    await teardownHarper(started);
  };
}
```

The real fixture is [`makeHarperFixture()`](https://github.com/HarperFast/nextjs/blob/593a8bf4d95bb92bf1fa64cbf335ace0bb28d2d4/integrationTests/fixture.ts#L40-L78) in the Next.js plugin. It also takes environment, application, and HTTP options that this excerpt leaves out.

The fixture provides the started Harper to Playwright through `use`, then tears it down when that use finishes. The startup timeout allows for the application build. It is a deadline, not a fixed two-minute sleep.

The test consumes the fixture like any other Playwright resource. In this excerpt, `name` selects the application fixture:

```typescript
const test = base.extend<
  {}, { harper: HarperContext }
>({
  harper: [makeHarperFixture(name),
           { scope: 'worker' }],
});

test('home page renders',
  async ({ page, harper }) => {
    await page.goto(harper.httpURL);
    await expect(page.locator('h1'))
      .toHaveText('Next.js v16');
  });
```

In the plugin, a small [`fixture()` helper](https://github.com/HarperFast/nextjs/blob/593a8bf4d95bb92bf1fa64cbf335ace0bb28d2d4/integrationTests/fixture.ts#L80-L85) builds this `test` for a named fixture, and each spec starts with it, as in [`next-16.pw.ts`](https://github.com/HarperFast/nextjs/blob/593a8bf4d95bb92bf1fa64cbf335ace0bb28d2d4/integrationTests/next-16.pw.ts). The [Playwright config](https://github.com/HarperFast/nextjs/blob/593a8bf4d95bb92bf1fa64cbf335ace0bb28d2d4/integrationTests/playwright.config.ts#L9-L11) runs two workers on CI, each on its own loopback address.

Worker scope means tests in that worker can share the instance. It doesn't automatically reset application data between tests. The fixture scope and test behavior still have to agree on ownership of mutable state.

## Sharding across CI runners

Local parallelism has a ceiling. A default hosted runner has fewer resources than my laptop, and increasing concurrency eventually makes it compete harder for those same resources.

Sharding distributes files across machines. The deck shows the initial four-shard shape as a workflow excerpt:

```yaml
# .github/workflows/integration-tests.yml
strategy:
  matrix:
    shard: [1, 2, 3, 4]
steps:
  - run: node --test --test-shard=${{ matrix.shard }}/4
```

Harper's workflow has since grown to six shards per configuration. See the [shard matrix](https://github.com/HarperFast/harper/blob/b1fb0c97649ffeb4b85e349d3db7f571bb7392a8/.github/workflows/integration-tests.yml#L112-L114) and the [test command](https://github.com/HarperFast/harper/blob/b1fb0c97649ffeb4b85e349d3db7f571bb7392a8/.github/workflows/integration-tests.yml#L193) in `integration-tests.yml`.

Each shard can also execute several files concurrently. These controls operate at different levels: sharding distributes files across runners; concurrency limits active files inside each runner.

For the same discovered file set, shard assignment is deterministic. I can select the same shard locally when investigating a failure. That reproduces the group of files, though it doesn't guarantee reproducing a timing-dependent failure. The programmatic runner also accepts `run({ shard: { index, total } })`.

This depends on files being independent. A file that expects another file to load its database can't move freely between shards. Process isolation, private directories, and address allocation made that independence practical.

## What changed in practice

I measured source history and CI runs through October 22, 2026. These observations cover different windows and changing suites. They are not a controlled benchmark of the old framework against the new one. The data, method, and scripts behind every number below are on [a separate page](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/), with one heading per number.

### The legacy suite and its port

The legacy suite predates the open-source split. It was written in the private `harperdb` repository for Harper v4, starting in December 2024, with converted Postman tests added in February 2025. It came into the public `harper` repository in October 2025 and stayed there until June 2026. You can still read its entry point at [HarperFast/harper@fb098c0](https://github.com/HarperFast/harper/blob/fb098c0f54f4321848bc2ae7c9cca05aee709a2c/integrationTests/apiTests/tests/testSuite.mjs), the commit just before the new framework landed:

```javascript
describe('Main Test Suite', async () => {
  await import('./0_envCleanup.mjs');
  await import('./1_environmentSetup.mjs');
  await import('./2_dataLoad.mjs');
  await import('./3_sqlTests.mjs');
  // … 23 more, in exactly this order
  await import('./26_crlVerification.mjs');
});
```

It ran 28 ordered modules inside one `describe`, against one Harper instance configured with `THREADS_COUNT: 1`. It had [974 test calls](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/#legacy-suite-size), about 929 active after static skips. Files depended on state left by earlier files, so the suite couldn't be sharded.

Its test step took [a median 7.4 minutes](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/#legacy-test-step-time), with a p90 of 7.7 minutes across 1,040 job steps from May through June 2026. Older step timings had expired. A static count found [about 315 seconds](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/#hard-coded-waits), or 5.3 minutes, of hard-coded waits: 191 seconds in test files and 124 seconds around restarts. Faster hardware can't do much about five minutes of sleeping.

The framework merged in December 2025 and became a separate package in April 2026. Kris Zyp ported the legacy suite with coding agents between May 15 and June 9, [about three and a half weeks](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/#port-timeline). Fourteen port PRs produced 17 self-contained files with their own Harper instances. The cleanup deleted 19,977 lines of legacy tests and infrastructure.

### More tests within a bounded feedback window

The legacy source count moved from 974 to 993 tests over seven months. The new suite reached 1,096 test calls after the port and [2,435 by October 22](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/#test-cases-over-time), adding 1,339 after migration.

The October 22 green main run reported [2,652 tests](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/#tests-and-instances-per-run) across the six Linux Node 24 shards: 2,630 passed, 21 skipped, one todo, and zero failures. Generated tests explain why the runtime count exceeds the source count. That run started 423 Harper instances across 263 test files.

Its top-level suite durations [summed to about 82 minutes](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/#summed-suite-time-vs-slowest-shard). The slowest shard finished in 5.6 minutes, a ratio of about 15 to one. That combines concurrency inside each shard with distribution across six shards.

The 82 minutes is summed suite time measured during concurrent execution, not an observed serial run. Concurrent files compete for CPU, so it slightly overstates true serial time. It illustrates overlapping work; it isn't a controlled 15x speedup measurement.

For successful main runs in the last 30 days, the full matrix took [a median 12.1 minutes](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/#time-to-a-full-result) from first job start to last job end, with a p90 of 13.1 minutes. That includes 36 shard jobs: six each for Linux Node 22, 24, and 26, Windows, Bun, and uWS. PRs run 24 shard jobs and took a median 11.5 minutes. Windows runs a subset of 871 tests.

Those full-matrix times cannot be compared directly with the legacy 7.4-minute test step. The tests, setup, platforms, and matrix all differ. The useful result is how much work fits into the feedback window.

### Adoption beyond the core suite

In Harper Pro, cluster coverage grew from [one file in March to 105 in October](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/#cluster-test-growth). The old cluster harness provisioned EC2, started five Docker containers, slept, and ran Newman/Postman tests over SSH. The new lifecycle can start multiple local instances in one test file, each with its own address, as in [`addNodeFullCopy.test.mjs`](https://github.com/HarperFast/harper-pro/blob/3dc5419336044ebfeb88febd21e10d693b0e2d1f/integrationTests/cluster/addNodeFullCopy.test.mjs#L61).

The Next.js adapter uses 53 Playwright tests in 12 spec files and ten fixtures covering Next.js 14, 15, and 16. Harper also runs an [advisory downstream check](https://github.com/HarperFast/harper/blob/b1fb0c97649ffeb4b85e349d3db7f571bb7392a8/.github/workflows/integration-tests-nextjs.yml) against the adapter using the proposed Harper build.

That check had [3,336 workflow runs](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/#downstream-check) from July 15 through October 22. In a sample of 250, only 212 executed the suite because the check is path-filtered. Thirteen of those 212, about 6%, failed on at least one Node version. Some failures may come from the adapter repository's `nextjs` main branch rather than the Harper PR. The 6% applies to sampled suite runs, not all 3,336 workflow runs or confirmed Harper regressions.

Across HarperFast, [31 other repositories](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/#repos-importing-the-package) import the package in test files, excluding the private advisory fork. Some have substantial suites; many templates have one smoke test.

Core CI usage reached [1,428 runs in the last 30 days](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/#ci-runs-per-month), exercising about 347 PR head branches excluding Renovate. December had 68 runs and 20 PR branches. The [share of merged PRs touching integration tests](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/#prs-touching-integration-tests) grew from roughly 6–13% per month in February through April to 18–30% in June through September. Overall PR volume also grew as the team adopted coding agents. These numbers show usage and participation, not proof that this framework caused faster delivery.

Among commits whose subjects start with `fix`, [47%](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/#fixes-that-ship-an-integration-test) added or changed an integration test in September. That subject-prefix heuristic misses fixes titled differently, but it gives us a repeatable measure.

### Failure rate is not flake rate

The legacy API jobs failed on at least one Node version in [52 of 450 first-attempt main push runs](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/#legacy-main-branch-failures), or 11.6%. In 66% of failing attempts, another Node version passed on the same commit. That suggests instability worth investigating, but a genuine version-specific regression can produce the same pattern.

The new workflow also fails. Main-push failure rates reached 52–66% during June through August as the suite and runtime matrix expanded. In the last 30 days, [55 of 253 main runs failed](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/#last-30-days), about 22%. Linux Node shards failed in 11% of runs; roughly half the failed runs failed only on Windows, Bun, or uWS.

Those failures include real regressions, including the Node 26 problems that led to temporarily pinning its version. Run metadata can't separate every regression from a flake. [Runs that eventually turned green after a retry](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/#re-runs-that-turned-green) fell from 12.9% of completed runs in July to 4.3% in September, but that is still only a proxy.

The old and new suites and matrices differ. These measurements do not establish that CI became less flaky. They establish more coverage, broader use, and a clearer place to investigate each failure.

## Next: stability

My next focus is making those failures easier to reproduce and classify. Each failure now points to a test file, its application instances, and their logs. I want to use that boundary to separate startup problems, test races, and actual regressions, then fix the recurring causes instead of relying on another rerun.
