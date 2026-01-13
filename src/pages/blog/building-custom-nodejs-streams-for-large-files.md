---
layout: ../../layouts/PostLayout.astro
title: "Building Custom Node.js Streams: Splitting a 1GB File Without Running Out of Memory"
pubDate: 2026-01-13T12:00:00-06:00
editDate: 2026-01-13T12:00:00-06:00
description: "What started as generating prime numbers for Project Euler problems evolved into a ~1GB file that broke my development tools. Follow along as I build custom Node.js Writable and Transform streams to efficiently split large files, learning about backpressure, memory management, and the pitfalls of garbage collection along the way."
---

## Prime Number Curiosity

Math has always fascinated me, especially when it intersects with programming. Recently, I started working through the [Project Euler](https://projecteuler.net/) problem set to sharpen my computational mathematics skills. As an added challenge, I avoid using any third-party libraries when solving these problems limiting myself to the standard JavaScript `Math` API and whatever I can build from scratch. My overall goal is not just to solve the problems, but also to deeply understand them, the underlying concepts, and even work through potential optimizations both mathematically and algorithmically.

> This post does not contain any Project Euler solutions, but it is not technically 100% spoiler-free.
> 
> It includes some utility functions I created to solve problems, a small hint to problem 5, and briefly discusses the extremely-inefficient, naive solution concept for problem 41.
>
> This information is only provided from a story-telling perspective in order to explain why and how I wound up with a large file of prime numbers!
> 
> Other than the specific details above, there are no other Project Euler spoilers in this post. Enjoy!

### Prime Number Utilities

As of writing this post, I've solved only about 40 problems from the set of over 900. Throughout these early problems, the concept of prime numbers has appeared frequently. For example, the 3rd problem, [Largest prime factor](https://projecteuler.net/problem=3), asks for the largest prime factor of a large number, and the 7th problem, [10001st Prime](https://projecteuler.net/problem=7), simply asks what is the 10001st prime number? Prime numbers are fundamental to so much of mathematics that they start popping up even when not directly mentioned by the problem. For example, the 5th problem, [Smallest Multiple](https://projecteuler.net/problem=5), asks to determine the smallest positive number that is evenly divisible by all the numbers from 1 to 20. Without giving too much away, there is a really useful trick to solving this problem when you consider how divisibility and prime factorization are related. Clearly, primes are important for mathematical and computational problem solving.

As I worked through various problems requiring prime numbers, I started creating my own set of prime number utilities. Starting with the most important function, `isPrime(n)`, for determining if a number `n` is a prime or not:

```typescript
function isPrime(n: number): boolean {
	if (n === 2) return true;
	if (n < 2 || n % 2 === 0) return false;
	for (let i = 3; i <= Math.sqrt(n); i++) {
		if (n % i === 0) return false;
	}
	return true;
}
```

> I acknowledge this is **not** the most efficient way to validate a prime number, but once again, my main goal is simply to refine my computational mathematics skills. If I ever needed the _most efficient_ solution I would absolutely consider additional resources.

Initially, this method was simple enough to solve the early problems. During runtime, I could iterate over a range, check if a given number is prime, and then do whatever additional logic necessary for solving the problem at hand. I knew this was inefficient, and so I quickly turned to my favorite dynamic programming concept, [memoization](https://en.wikipedia.org/wiki/Memoization), to improve my utility methods.

Instead of computing primes during the runtime of any given problem solution, I decided to generate a set of prime numbers ahead of time, save that to a file, and then have my solutions use the set directly.

Equipped with my naive `isPrime()` function, and the power of [JavaScript generators](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Generator), I came up with this solution:

```typescript
function* primeGenerator({
	limit = Number.MAX_SAFE_INTEGER,
	count = Number.MAX_SAFE_INTEGER,
} = {}) {
	let n = 2;
	let c = 0;
	while (n < limit && c < count) {
		if (isPrime(n)) {
			c++;
			yield n;
		}
		n++;
	}
	return null;
}
```

This solution allowed me to still compute primes at runtime if I wanted, such as:

```typescript
for (const prime of primeGenerator()) {
  // 2, 3, 5, 7, 11, ...
}
```

But also, I could use this generator along with Node.js [Stream](https://nodejs.org/api/stream.html) and [File System](https://nodejs.org/api/fs.html) APIs and the [`pipeline()`](https://nodejs.org/api/stream.html#streampipelinesource-transforms-destination-callback) utility to write the prime numbers to a file:

```typescript
await pipeline(
  primeGenerator({ count: 100_000 }),
  new Transform({
    objectMode: true,
    transform(chunk, encoding, callback) {
      callback(null, chunk ? `${chunk}\n` : chunk);
    },
  }),
  createWriteStream('primes-count-100-000.txt'),
);
```

The [`Transform`](https://nodejs.org/api/stream.html#class-streamtransform) stream is required here to transform the prime numbers produced by `primeGenerator()` into strings with newlines. Otherwise, every prime number would be written immediately after one another on a single line.

While this implementation is not the fastest way to generate primes, because it uses a generator, it could at least efficiently generate essentially infinite values without ever running out of memory. For the relatively low count of one-hundred thousand prime numbers, this script runs in 0.25 seconds on my M1 MacBook Pro and generates a 708KB file.

```
❯ time node generatePrimes.ts 
  node generatePrimes.ts  0.29s user 0.02s system 125% cpu 0.250 total
❯ du -h primes-count-100-000.txt
  708K    primes-count-100-000.txt
❯ wc -l ./primes/primes-count-100-000.txt
  100000 ./primes/primes-count-100-000.txt
❯ tail -n 1 ./primes/primes-count-100-000.txt
1299709
```

> I verified the correctness of my utilities by comparing my `primes-count-100-000.txt` output to the [OEIS A000040 integer sequence](https://oeis.org/A000040).

Now throughout my solutions, instead of generating primes on the fly, I can read the file into memory and use the data however necessary:

```typescript
const primes = readFileSync('primes-count-100-000.txt', 'utf-8');

const primeArray = primes
		.trim()
		.split('\n')
		.map((n) => parseInt(n));

for (const prime of primeArray) {
  // 2, 3, 5, 7, 11, ...
}

primeArray[99]; // the 100th prime number is ...

const primeSet = new Set(primeArray);

primeSet.has(123); // equivalent `isPrime(123)` check
```

> There is still some performance overhead to reading the file and then doing operations like `split()` and `map()`, but it is significantly faster compared to computing primes at runtime.

### From the 100,000th Prime to all Primes less than 2,000,000

Throughout most of the early problems, 100,000 prime numbers was plenty. When I eventually got to problem 10, [Summation of Primes](https://projecteuler.net/problem=10), it wanted the sum of all prime numbers below two million. Now the 100,000th prime number is only 1,299,709 so the pre-computed set was clearly not large enough. So lets generate a new set with `limit: 2_000_000` instead of `count: 100_000`:

```typescript
primeGenerator({ limit: 2_000_000 });
```

```
❯ time node primes/generatePrimes.ts
  node primes/generatePrimes.ts  0.41s user 0.03s system 116% cpu 0.376 total
❯ du -h primes/primes.txt
  2.0M    primes/primes.txt
```

Now, this script takes 0.376 seconds and results in a file 2.0MB large; not bad!

> And with a couple more useful commands, it turns out the largest prime number less than two million is 1,999,993 and it is the 148,933rd prime number!
> 
> ```
> ❯ tail -n 1 primes/primes.txt
>   1999993
> ❯ wc -l primes/primes.txt
>   148933 primes/primes.txt
> ```
>

So in order to solve problem 10, I only had to generate roughly 50,000 more prime numbers than I had previously.

### Primes less than 1,000,000,000

Fast-forward to problem 41, [Pandigital Prime](https://projecteuler.net/problem=41):

> We shall say that an $n$-digit number is pandigital if it makes use of all the
digits $1$ to $n$ exactly once. For example, $2143$ is a $4$-digit pandigital
and is also prime.
>
> What is the largest $n$-digit pandigital prime that exists?

As I mentioned at the beginning of the post, in the spirit of Project Euler, I will **not** discuss the solution too much, but hopefully the extremely-inefficient, naive solution is obvious enough.

In order to find the _largest_, check _all_ prime numbers up to 9-digits long.

> This problem is actually a really fun one to consider shortcuts and optimizations for. I'll leave those as exercises to the reader. Good luck!

For the naive solution, I went back to my prime number generator script and changed the limit to 1,000,000,000 since I needed all prime numbers up to 9-digits long.

```typescript
primeGenerator({ limit: 1_000_000_000 });
```

This time it took nearly half-an-hour to execute, and the resulting text file is 480MB! My dev tools, VS Code and Git, can still handle this file size okay with only a little bit of lag. Something as simple as `git add primes-limit-1-000-000-000.txt` takes a few seconds now instead of the relatively-instantaneous few milliseconds.

And using `wc` and `tail` again, it turns out 999,999,937 is the 50,847,534th prime number and the largest 9-digit prime number.

```
❯ wc -l primes-limit-1-000-000-000.txt
  50847534 primes-limit-1-000-000-000.txt
❯ tail -n 1 primes-limit-1-000-000-000.txt
  999999937
```

### The 100,000,000th Prime Number

So now I'm just curious, what is the 100,000,000th prime number? Double the amount of prime numbers generated in the previous section.

After updating my generator back to using `count`:

```typescript
primeGenerator({ count: 100_000_000 });
```

And nearly an hour of execution time later, I had my answer: 2,038,074,743 is the 100,000,000th prime number!

```
❯ wc -l primes-count-100-000-000.txt
  100000000 primes-count-100-000-000.txt
❯ tail -n 1 primes-count-100-000-000.txt
  2038074743
```

> In a future post I will work through optimizing my prime number generation using alternative algorithms and exploring parallel computing too.

And just how large is _this_ file?

```
❯ du -h primes-count-100-000-000.txt
  994M    primes-count-100-000-000.txt
```

994MB, nearly an entire gigabyte! VS Code is nearly crashing trying to open this file, and git is completely timing out in my shell. In my project, I have prettier, husky, and lint-staged set up to do some automatic formatting on commit and this process completely breaks due to the size of the file. I'm not sure which tool can't handle it, but the point is nearly a gigabyte in size is just too large!

## Data, oh so much data!

So what is there to do? I could just delete the file and return to a smaller set, but what if future problems require these values? Furthermore, what if there are future, large number sets to deal with?

Inspired by stream-like characteristics of the `primeGenerator()` utility, I wondered how difficult it would be to not only split-up the large files I already have generated, but also create an interface for efficiently storing large number sets across multiple files.

Since the `primeGenerator()` method was already producing `number` values, I decided to focus on building a stream sink that would take the numbers as inputs, and write them to files up to a given size separated by newlines. This allows for the files to not only be human readable, but also easy to work with programmatically.

The existing files would be slightly harder, but my thinking was if I can succeed at building a sink that can store numbers efficiently, I then just had to create a transform utility to read and parse the numbers from the existing files, and stream them along to the same interface.

And both of these stream implementations would likely be useful for future computational problems either for processing files containing lists of numbers, or efficiently storing other number sets.

## The `NumberWriter` Writable Stream

As previously demonstrated, streams and generators work well together. When implemented properly, one stream can pipe to another without ever exceeding process memory limits enabling programmatic usage of very large data sources and sinks.

Thus, the primary solution should be a custom Node.js Stream that can be used with the `pipeline()` and [`stream.pipe()`](https://nodejs.org/api/stream.html#readablepipedestination-options) utility methods. These methods are particularly useful as they automatically handle [backpressure](https://nodejs.org/api/stream.html#buffering) as long as all of the parts are properly implemented as well. A custom [`Writable`](https://nodejs.org/api/stream.html#class-streamwritable) should be sufficient as it will be the destination for the input data. This solution will be an intermediary between the input stream and the multiple file output streams ensuring the input data is valid and within the configured size limit, backpressure is respected during the actual file write operations, and that any errors are properly propagated. The Node.js File System API [`WriteStream`](https://nodejs.org/api/fs.html#class-fswritestream) will be very useful for this solution.

At a high-level, this solution should:

1. Receive data from an input stream source, validating each new value to be a JavaScript `number`
2. Write the input values to an output file until a file size is reached
   - [`writeStream.bytesWritten`](https://nodejs.org/api/fs.html#writestreambyteswritten) seems useful for this
   - The output destination and file size limit should be configurable
3. Once the file size is reached, rotate the output file
   - Ensure the previous output file stream is properly closed
   - Ensure the new output file stream is properly opened
4. Propagate any errors that occur throughout streaming
5. Continue this until the input ends
   - Don't forget to properly close the final output stream

> For this solution, I'm using Node.js v24 automatic type-stripping with TypeScript and ESM.

Getting started with some boilerplate:

```typescript
import { Writable } from 'node:stream';

type Callback = (error?: Error | null) => void;

export class NumberWriter extends Writable {
	constructor() {}

	_construct(callback: Callback): void {}

	_write(number: unknown, _encoding: any, callback: Callback): void {}

	_destroy(error: Error | null, callback: Callback): void {}

	_final(callback: Callback): void {}
}
```

For simplicity, the `_writev()` method is omitted. Furthermore, the `Callback` type is extracted from the `Writable` type definitions to simplify method type signatures throughout the implementation.

Input values are intended to be JavaScript `number` type; thus, enable the Writable [`objectMode`](https://nodejs.org/api/stream.html#object-mode) option. I've found it easiest to limit and validate chunk types to exactly what I want to support; otherwise, the complexity can get out of hand. You can always use a `Transform` stream to convert chunk types efficiently. Now, this option doesn't necessarily limit what can be written to this stream, and so we will also validate chunks within the `_write()` method.

The output destination and file size limit should be configurable. These should be constructor options, and the `maxFileSize` should have some reasonable default, like 100MB. Additionally, this option should be validated to be at least as large as one number per file. For obvious reasons this edge-case of storing one number per file would be extremely inefficient, but it is beneficial to consider the possibility nonetheless. I used the `max` prefix here, because the implementation technically won't always have the same file size. The last file will likely be smaller, and when working with reasonably large numbers, there is the possibility for small size differentials when the next prime would exceed the specified maximum file size. 

Right now, the implementation focuses on integers, but could easily be adapted to support `BigInt` or even floats too.

```typescript
import { Writable } from 'node:stream';

type Callback = (error?: Error | null) => void;

interface NumberWriterOptions {
	outputDir?: string;
	maxFileSize?: number;
}

const minFileSize = Buffer.from(`${Number.MAX_SAFE_INTEGER}\n`, 'utf8').length;

export class NumberWriter extends Writable {
	#outputDir: string;
	#maxFileSize: number;

	constructor(options: NumberWriterOptions = {}) {
		// Enable `objectMode` to support JavaScript `number` types in `_write()`
		super({ objectMode: true });

		if (options.outputDir && typeof options.outputDir !== 'string') {
			throw new TypeError('`outputDir` option should be a string');
		}

		this.#outputDir = options.outputDir || '';

		if (options.maxFileSize && typeof options.maxFileSize !== 'number') {
			throw new TypeError('`maxFileSize` option should be a number');
		}

		if (options.maxFileSize < minFileSize) {
			throw new TypeError(`\`maxFileSize\` option should be greater than or equal to the minimum file size of ${minFileSize} bytes`);
		}

		this.#maxFileSize = options.maxFileSize || 50 * 1024 * 1024; // default: 50MB
	}
}
```

It may be useful to support additional `Writable` options here and pass them through to the `super()` call, but this is sufficient for now.

Next, lets implement the `_construct()` method. This is a reasonable place to asynchronously setup the output directory, and the first output file stream.

```typescript
import { createWriteStream, type WriteStream } from 'node:fs';
import { join } from 'node:path';

export class NumberWriter extends Writable {
	#currentFileIndex = 0;
	#currentStream: WriteStream;

	// ...

	_construct(callback: Callback): void {
		if (this.#outputDir) {
			mkdir(this.#outputDir, { recursive: true }, (err) => {
				if (err) return callback(err);

				this.#openNextFile(callback);
			});
		} else {
			this.#openNextFile(callback);
		}
	}

	#openNextFile(callback: Callback): void {
		try {
			const filename = `${this.#currentFileIndex++}.txt`.padStart(10, '0');
			this.#currentStream = createWriteStream(join(this.#outputDir, filename));

			this.#currentStream.on('error', (err) => {
				this.destroy(err);
			});

			this.#currentStream.once('ready', callback);
		} catch (error) {
			callback(error);
		}
	}

	// ...
}
```

There are two new private instance properties, `#currentFileIndex` is an incremental index for the file output names and `#currentStream` is the current file output `WriteStream`.

The `_construct()` method starts off simple enough checking the `#outputDir` value and asynchronously creating the output directory if specified. It properly handles any errors that occur as a result of [`mkdir()`](https://nodejs.org/api/fs.html#fsmkdirpath-options-callback), and then moves on to creating the first output file stream. The `#openNextFile()` method uses the `#currentFileIndex` to create a file name by padding `0`s to the front of the index value. So for example if the index value is `1`, the resulting file name is `000001.txt`. It then creates the output file stream using [`createWriteStream()`](https://nodejs.org/api/fs.html#fscreatewritestreampath-options). The try-catch block is there to catch any errors thrown by `createWriteStream()` since it does not accept a callback. The resulting stream is assigned an `'error'` event listener that passes along any errors to the instance's `destroy()` method. This error handling will be important and make more sense later when analyzing the `_write()` implementation. Finally, a singular `'ready'` event handler is established passing through the `callback`.

The error handling established here passes through errors from the output file stream to the `_destroy()` method:

```typescript
export class NumberWriter extends Writable {
	// ...

	_destroy(error: Error | null, callback: Callback): void {
		if (this.#currentStream) {
			this.#currentStream.end(() => {
				this.#currentStream.removeAllListeners();
				callback(error);
			});
		} else {
			callback(error);
		}
	}

	// ...
}
```

If an output file stream exists, this properly ends the stream with `end()`, removes any event listeners with `removeAllListeners()`, and then passes along any potential errors to the `callback()`. These steps are important to not leak the underlying file descriptor or associated event listeners for the output file write stream.

With all the setup complete, now the `_write()` implementation.

```typescript
export class NumberWriter extends Writable {
	// ...

	_write(number: unknown, _encoding: any, callback: Callback): void {
		if (typeof number !== 'number' || !Number.isFinite(number)) {
			return callback(
				new Error(
					`Unexpected chunk type ${typeof number}. Only pass literal JavaScript numbers, \`stream.write(123456);\``,
				),
			);
		}

		const line = number.toString() + '\n';
		const buffer = Buffer.from(line, 'utf8');
		const byteSize = buffer.length;

		if (this.#currentStream.bytesWritten + byteSize > this.#maxFileSize) {
			this.#currentStream.end(() => {
				this.#currentStream.removeAllListeners();
				this.#openNextFile((error) => {
					if (error) return callback(error);

					this.#currentStream.write(buffer, callback);
				});
			});
		} else {
			this.#currentStream.write(buffer, callback);
		}
	}

	// ...
}
```

The `_write()` method starts with validation of the `number` argument. The instance does have `objectMode` enabled, but that doesn't prevent the input from being any object type. Furthermore, in `objectMode`, the `_encoding` argument is unnecessary hence the `_` prefix. The `Number.isFinite()` check is only relevant since this is currently for prime numbers, but that can be removed to make the implementation more versatile for different inputs such as to support `BigInt` or floats. The valid `number` value is then converted to the string to be written to the output file stream. The string is encoded as an utf8 `Buffer` and then the resulting `byteSize` is validated. Since this implementation uses JavaScript `number` type, the maximum size of a single line is 17 bytes. The constructor asserts that the specified file size can at least handle a single large integer. The `byteSize` is checked against the number of bytes written to the current output stream before continuing.

If the new `byteSize` and the current stream's `bytesWritten` exceeds the maximum file size, then the current stream is rotated. Finally, the `buffer` is written to the file stream using the `this.#currentStream.write(buffer, callback)` method. Backpressure is properly handled by passing through the `callback` to the underlying output stream. The underlying stream will only execute the `callback` after it has flushed the `buffer`, and since this is the same `callback` for the `NumberWriter._write()` method, that will bubble up to whatever is writing to the `NumberWriter`.

Lastly, the `_final()` method is important to ensure everything is properly finished and cleaned up.

```typescript
export class NumberWriter extends Writable {
	// ...

	_final(callback: Callback): void {
		if (this.#currentStream) {
			this.#currentStream.end(() => {
				this.#currentStream.removeAllListeners();
				callback(null);
			});
		} else {
			callback(null);
		}
	}
}
```

This implementation is very similar to the `_destroy()` method, except that there are no errors to handle. The `'error'` event listener for the `this.#currentStream` is not removed until after `end()` completes, so if an error does occur, it will be passed through to `_destroy()` still. Once this method is called the `NumberWriter` instance itself is complete. All output files should be written and there should be no orphaned file descriptors or event listeners.

The complete implementation for `NumberWriter` is:

```typescript
import { createWriteStream, mkdir, type WriteStream } from 'node:fs';
import { join } from 'node:path';
import { Writable } from 'node:stream';

type Callback = (error?: Error | null) => void;

export interface NumberWriterOptions {
	outputDir?: string;
	maxFileSize?: number;
}

const minFileSize = Buffer.from(`${Number.MAX_SAFE_INTEGER}\n`, 'utf8').length;

export class NumberWriter extends Writable {
	#currentFileIndex = 0;
	#currentStream: WriteStream;
	#outputDir: string;
	#maxFileSize: number;

	constructor(options: NumberWriterOptions = {}) {
		super({ objectMode: true });

		if (options.outputDir && typeof options.outputDir !== 'string') {
			throw new TypeError('`outputDir` option should be a string');
		}

		this.#outputDir = options.outputDir || '';

		if (options.maxFileSize && typeof options.maxFileSize !== 'number') {
			throw new TypeError('`maxFileSize` option should be a number');
		}

		if (options.maxFileSize < minFileSize) {
			throw new TypeError(
				`\`maxFileSize\` option should be greater than or equal to the minimum file size of ${minFileSize} bytes`,
			);
		}

		this.#maxFileSize = options.maxFileSize || 50 * 1024 * 1024; // Default: 50MB
	}

	_construct(callback: Callback): void {
		if (this.#outputDir) {
			mkdir(this.#outputDir, { recursive: true }, (err) => {
				if (err) return callback(err);

				this.#openNextFile(callback);
			});
		} else {
			this.#openNextFile(callback);
		}
	}

	#openNextFile(callback: Callback): void {
		try {
			const filename = `${this.#currentFileIndex++}.txt`.padStart(10, '0');
			this.#currentStream = createWriteStream(join(this.#outputDir, filename));

			this.#currentStream.on('error', (err) => {
				this.destroy(err);
			});

			this.#currentStream.once('ready', callback);
		} catch (error) {
			callback(error);
		}
	}

	_write(number: unknown, _encoding: any, callback: Callback): void {
		if (typeof number !== 'number' || !Number.isFinite(number)) {
			return callback(
				new Error(
					`Unexpected chunk type ${typeof number}. Only pass literal JavaScript numbers, \`stream.write(123456);\``,
				),
			);
		}

		const line = number.toString() + '\n';
		const buffer = Buffer.from(line, 'utf8');
		const byteSize = buffer.length;

		if (this.#currentStream.bytesWritten + byteSize > this.#maxFileSize) {
			this.#currentStream.end(() => {
				this.#currentStream.removeAllListeners();
				this.#openNextFile((error) => {
					if (error) return callback(error);

					this.#currentStream.write(buffer, callback);
				});
			});
		} else {
			this.#currentStream.write(buffer, callback);
		}
	}

	_destroy(error: Error | null, callback: Callback): void {
		if (this.#currentStream) {
			this.#currentStream.end(() => {
				this.#currentStream.removeAllListeners();
				callback(error);
			});
		} else {
			callback(error);
		}
	}

	_final(callback: Callback): void {
		if (this.#currentStream) {
			this.#currentStream.end(() => {
				this.#currentStream.removeAllListeners();
				callback(null);
			});
		} else {
			callback(null);
		}
	}
}

```

## Using `NumberWriter` with `primeGenerator()`

Now for the fun part; lets integrate the `NumberWriter` with `primeGenerator()` and see it in action.

Previously, `pipeline()` was used to write all values from `primeGenerator()` to a `primes-count-100-000.txt` output file. For a reasonably sized example, lets use `{ limit: 1_000_000 }` for the generator and lets create a reference point to verify the new solution against.

```typescript
await pipeline(
  primeGenerator({ limit: 1_000_000 }),
  new Transform({
    objectMode: true,
    transform(chunk, encoding, callback) {
      callback(null, chunk ? `${chunk}\n` : chunk);
    },
  }),
  createWriteStream('primes-limit-1-000-000.txt'),
);
```

This results in a file size of 528KB and 78,498 prime numbers.

And now lets try the same prime generator configuration with `NumberWriter`. The `Transform` stream was required in order to convert the `number` type values from `primeGenerator()` into strings for writing to the file. Since that logic is now encapsulated into `NumberWriter` itself, the output of `primeGenerator()` can be piped directly into `NumberWriter`. Given the expected output size, lets set the `maxFileSize` to 100KB. If our implementation is correct, this should generate 6 files, 5 of which are 100KB and the 6th is 28KB.

```typescript
await pipeline(
	primeGenerator({ limit: 1_000_000 }),
	new NumberWriter({
		maxFileSize: 100 * 1024,
		outputDir: join(import.meta.dirname, 'primes-limit-1-000-000')
	})
);
```

Executing this script results in these 6 files being generated:

```
primes-limit-1-000-000/
├── 000000.txt
├── 000001.txt
├── 000002.txt
├── 000003.txt
├── 000004.txt
└── 000005.txt
```

And to verify the size:

```
❯ du -h primes/primes-limit-1-000-000/*         
100K    primes/primes-limit-1-000-000/000000.txt
100K    primes/primes-limit-1-000-000/000001.txt
100K    primes/primes-limit-1-000-000/000002.txt
100K    primes/primes-limit-1-000-000/000003.txt
100K    primes/primes-limit-1-000-000/000004.txt
 28K    primes/primes-limit-1-000-000/000005.txt
❯ du -h primes/primes-limit-1-000-000/
528K    primes/primes-limit-1-000-000/
```

That looks good to me!

And line count:

```
❯ wc -l primes/primes-limit-1-000-000/*  
   16202 primes/primes-limit-1-000-000/000000.txt
   14628 primes/primes-limit-1-000-000/000001.txt
   14628 primes/primes-limit-1-000-000/000002.txt
   14628 primes/primes-limit-1-000-000/000003.txt
   14628 primes/primes-limit-1-000-000/000004.txt
    3784 primes/primes-limit-1-000-000/000005.txt
   78498 total
```

Fantastic, its working! The `NumberWriter` is able to efficiently generate a set of files from a stream of numbers.

## Using `NumberWriter` with really big file streams

Next, lets break up the extra large files.

We'll continue to use `pipeline()` here, but we'll replace `primeGenerator()` with [`fs.createReadStream()`](https://nodejs.org/api/fs.html#fscreatereadstreampath-options). This method returns a [`fs.ReadStream`](https://nodejs.org/api/fs.html#class-fsreadstream) which implements [`Readable`](https://nodejs.org/api/stream.html#class-streamreadable). For demonstration purposes, lets use the `primes-count-100-000.txt` file (count 100,000) we created at the very beginning.

The `NumberWriter` is only designed to handle `number` type inputs, but the `createReadStream()` streams [`Buffer`](https://nodejs.org/api/buffer.html#class-buffer) chunks by default. So now we need to implement some sort of transform stream to transform the chunks from the `ReadStream` into numbers.

Let's see what happens if we just pass each chunk to `parseInt()` after encoding it as a string.

```typescript
import { createReadStream } from 'node:fs';
import { Transform } from 'node:stream';
import { NumberWriter } from './NumberWriter.ts';

await pipeline(
	createReadStream(join(import.meta.dirname, 'primes-count-100-000.txt')),
	new Transform({
		readableObjectMode: true,
		transform(chunk, encoding, callback) {
			callback(null, parseInt(chunk.toString('utf8'), 10));
		},
	}),
	new NumberWriter({
		maxFileSize: 100 * 1024,
		outputDir: join(import.meta.dirname, 'primes-count-100-000'),
	}),
);
```

The resulting file `primes-count-100-000/000000.txt`:

```
2
5769
61
346091
67527
431
3
842987
1561
977
483

```

Hmm, that is definitely incorrect.

Lets add a log line to the `transform()` method and inspect the chunk sizes.

```typescript
await pipeline(
	// ...
	new Transform({
		// ...
		transform(chunk, encoding, callback) {
			console.log(
				'chunk details:',
				chunk.length,
				chunk.toString('utf8').split('\n').length,
			);
			callback(null, parseInt(chunk.toString('utf8'), 10));
		},
	}),
	// ...
);
```

Result:
```
chunk details: 65536 10937
chunk details: 65536 9363
chunk details: 65536 9363
chunk details: 65536 9364
chunk details: 65536 9363
chunk details: 65536 9363
chunk details: 65536 9364
chunk details: 65536 9363
chunk details: 65536 8446
chunk details: 65536 8193
chunk details: 55124 6892
```

So the first chunk is `65536` bytes long, and seems to contain 10,937 lines. Subsequent chunks are the same size (except for the last one) and contain decreasing number of lines. So no wonder the `parseInt()` didn't work!

The `ReadStream` doesn't care about the new lines; they are just another byte. Instead, it will always stream chunks of a certain size. The `ReadStream` defaults to `64KB`, or `64 * 1024`. This value is configurable by the [`highWaterMark`](https://nodejs.org/api/fs.html#fscreatereadstreampath-options) property.

Since the lines within the file are all of different lengths, there is no magic number that would consistently return chunks line-by-line. We have to buffer and implement this ourselves.

### The `LineToNumber` Transform Stream

Starting with some boilerplate again:

```typescript
import { Transform, type TransformCallback } from 'node:stream';

export class LineToNumber extends Transform {
	#prev: Buffer | undefined;

	constructor() {
		super({ readableObjectMode: true });
	}

	_transform(chunk: Buffer, _encoding: string, callback: TransformCallback) {}

	_flush(callback: TransformCallback) {}
}
```

Transform streams implement both Writable and Readable streams hence the name. Data can be written to and read from a transform stream, for the purpose of _transforming_ the data.

The key detail in this boilerplate is the options passed to `super()`. Since this transform stream will be producing `number` values, the [`readableObjectMode`](https://nodejs.org/api/stream.html#object-mode) must be enabled.

Now for the `_transform()` method implementation:

```typescript
export class LineToNumber extends Transform {
	// ...
	_transform(chunk: Buffer, _encoding: string, callback: TransformCallback) {
		let j = 0;
		for (let i = 0; i < chunk.length; i++) {
			// Scan until newline byte is found (0x0A = \n)
			if (chunk[i] === 10) {
				const slice = Buffer.copyBytesFrom(chunk, j, i);

				// Handle incomplete line from previous chunk
				if (this.#prev) {
					this.push(
						parseInt(this.#prev.toString('utf8') + slice.toString('utf8'), 10),
					);
					this.#prev = undefined;
				} else {
					this.push(parseInt(slice.toString('utf8'), 10));
				}

				j = i + 1;
			}
		}

		// Store incomplete line for next chunk (make a copy)
		if (j !== chunk.length) {
			this.#prev = Buffer.copyBytesFrom(chunk, j);
		}

		callback(null);
	}
	// ...
}
```

> **Note**: This implementation prioritizes correctness and clarity. When processing extremely large files (100M+ lines), there are additional memory optimization techniques that can further reduce garbage collection pressure, which I'll explore in a follow-up post.

Since we'll be controlling the source feeding into `LineToNumber`, we can assume that the `chunk` will always be a `Buffer`. A more general purpose solution may need some handling for `string` types as well.

The `_transform()` method is what is responsible for accepting input and producing output. Behind the scenes, the `Transform` class handles backpressure by managing writable and readable queues. The `callback()` method is for signaling when another chunk is ready for processing (pop a chunk from the internal writable queue and signal to source it can write another chunk). And the `this.push()` method is for pushing data to the read queue. Transforms do not have to be one-to-one. One input chunk can result in many output chunks, and vice-versa.

The transform starts by iterating through the bytes of the `chunk`. When it discovers a newline character (represented by the character code `10` in `utf8`), it creates a new buffer by copying bytes from the last known newline. It is important that this slice is a copy and not a reference to the original view for the input `chunk`. If the slice shared the same memory space, the chunks pushed to the readable queue would hold a reference to the original chunk, preventing the garbage collector from freeing the underlying memory. Since the readable queue drains slower than the writable queue (writing takes longer than reading and transforming), for very large inputs, references to a chunk will exist in the readable queue for far longer than the writable queue. Without the copies, this transform would face either memory leak issues or garbage collector locking.

The slice is then encoded as a string using `utf8` and then parsed as an integer using `parseInt()`. Of course, this can be modified to support floats or `BigInt` as the intended number set requires. As soon as the chunk is read, the garbage collector can free up that specific buffer copy associated with the given prime number.

> Sorry Windows users; you may need to implement additional logic for `\r\n` line endings instead of just `\n`.

Tracking the last known newline is crucial for ensuring that numbers can be produced across chunk boundaries. If the last known newline is not the end of the chunk itself, the remaining bytes are tracked in `this.#prev` and will be incorporated into the next transform step.

Additionally, the `_flush()` method is important for an edge case where a file does not end in a newline character (resulting in the last chunk storing the last prime number in `this.prev`).

```typescript
export class LineToNumber extends Transform {
	// ...
	_flush(callback: TransformCallback) {
		if (this.#prev) {
			this.push(parseInt(this.#prev.toString('utf8'), 10));
			this.#prev = undefined;
		}
		callback(null);
	}
}
```

Now, all together, we can pipeline the `ReadStream` from any of the large files into `new LineToNumber()` and then into `new NumberWriter()`.

Before trying this on the largest files, lets test using `primes-count-100-000.txt`.

```typescript
import { pipeline } from 'node:stream/promises';
import { createReadStream } from 'node:fs';
import { LineToNumber } from './LineToNumber.ts';
import { NumberWriter } from './NumberWriter.ts';

await pipeline(
	createReadStream(join(import.meta.dirname, 'primes-count-100-000.txt')),
	new LineToNumber(),
	new NumberWriter({
		maxFileSize: 100 * 1024,
		outputDir: join(import.meta.dirname, 'primes-count-100-000'),
	}),
);
```

Executing this script results in these 7 files being generated:

```
primes-count-100-000/
├── 000000.txt
├── 000001.txt
├── 000002.txt
├── 000003.txt
├── 000004.txt
├── 000005.txt
└── 000006.txt
```

Verify the size:

```
❯ du -h primes/primes-count-100-000/*
100K    primes/primes-count-100-000/000000.txt
100K    primes/primes-count-100-000/000001.txt
100K    primes/primes-count-100-000/000002.txt
100K    primes/primes-count-100-000/000003.txt
100K    primes/primes-count-100-000/000004.txt
100K    primes/primes-count-100-000/000005.txt
 96K    primes/primes-count-100-000/000006.txt
❯ du -h primes/primes-count-100-000/ 
696K    primes/primes-count-100-000/
❯ du -h primes/primes-count-100-000.txt
696K    primes/primes-count-100-000.txt
```

And line count:

```
❯ wc -l ./primes/primes-count-100-000/*      
   16202 ./primes/primes-count-100-000/000000.txt
   14628 ./primes/primes-count-100-000/000001.txt
   14628 ./primes/primes-count-100-000/000002.txt
   14628 ./primes/primes-count-100-000/000003.txt
   14628 ./primes/primes-count-100-000/000004.txt
   13273 ./primes/primes-count-100-000/000005.txt
   12013 ./primes/primes-count-100-000/000006.txt
  100000 total
❯ wc -l primes/primes-count-100-000.txt  
  100000 primes/primes-count-100-000.txt
```

They seem to match the original `primes-count-100-000.txt` file, perfect!

Okay, lets see how this goes for the 994MB size `primes-count-100-000-000.txt`, but lets use the default `maxFileSize` of 50MB instead.

```typescript
await pipeline(
	createReadStream(join(import.meta.dirname, 'primes-count-100-000-000.txt')),
	new LineToNumber(),
	new NumberWriter({
		outputDir: join(import.meta.dirname, 'primes-count-100-000-000'),
	}),
);
```

In the end,

```
primes-count-100-000-000/
├── 000000.txt
├── 000001.txt
├── 000002.txt
├── 000003.txt
├── 000004.txt
├── 000005.txt
├── 000006.txt
├── 000007.txt
├── 000008.txt
├── 000009.txt
├── 000010.txt
├── 000011.txt
├── 000012.txt
├── 000013.txt
├── 000014.txt
├── 000015.txt
├── 000016.txt
├── 000017.txt
├── 000018.txt
└── 000019.txt
```

Verify the size:

```
❯ du -h primes/primes-count-100-000-000/*
 50M    primes/primes-count-100-000-000/000000.txt
 50M    primes/primes-count-100-000-000/000001.txt
 50M    primes/primes-count-100-000-000/000002.txt
 50M    primes/primes-count-100-000-000/000003.txt
 50M    primes/primes-count-100-000-000/000004.txt
 50M    primes/primes-count-100-000-000/000005.txt
 50M    primes/primes-count-100-000-000/000006.txt
 50M    primes/primes-count-100-000-000/000007.txt
 50M    primes/primes-count-100-000-000/000008.txt
 50M    primes/primes-count-100-000-000/000009.txt
 50M    primes/primes-count-100-000-000/000010.txt
 50M    primes/primes-count-100-000-000/000011.txt
 50M    primes/primes-count-100-000-000/000012.txt
 50M    primes/primes-count-100-000-000/000013.txt
 50M    primes/primes-count-100-000-000/000014.txt
 50M    primes/primes-count-100-000-000/000015.txt
 50M    primes/primes-count-100-000-000/000016.txt
 50M    primes/primes-count-100-000-000/000017.txt
 50M    primes/primes-count-100-000-000/000018.txt
 45M    primes/primes-count-100-000-000/000019.txt
❯ du -h primes/primes-count-100-000-000/ 
997M    primes/primes-count-100-000-000/
❯ du -h primes/primes-count-100-000-000.txt
994M    primes/primes-count-100-000-000.txt
```

> The 3M difference makes sense for the file system overhead of 20 individual files.

And line count:

```
❯ wc -l primes/primes-count-100-000-000/*
 5894435 primes/primes-count-100-000-000/000000.txt
 5242880 primes/primes-count-100-000-000/000001.txt
 5242880 primes/primes-count-100-000-000/000002.txt
 5242880 primes/primes-count-100-000-000/000003.txt
 5242880 primes/primes-count-100-000-000/000004.txt
 5242880 primes/primes-count-100-000-000/000005.txt
 5242880 primes/primes-count-100-000-000/000006.txt
 5242880 primes/primes-count-100-000-000/000007.txt
 5242880 primes/primes-count-100-000-000/000008.txt
 5039896 primes/primes-count-100-000-000/000009.txt
 4766254 primes/primes-count-100-000-000/000010.txt
 4766254 primes/primes-count-100-000-000/000011.txt
 4766254 primes/primes-count-100-000-000/000012.txt
 4766254 primes/primes-count-100-000-000/000013.txt
 4766254 primes/primes-count-100-000-000/000014.txt
 4766254 primes/primes-count-100-000-000/000015.txt
 4766254 primes/primes-count-100-000-000/000016.txt
 4766254 primes/primes-count-100-000-000/000017.txt
 4766254 primes/primes-count-100-000-000/000018.txt
 4226343 primes/primes-count-100-000-000/000019.txt
 100000000 total
❯ wc -l primes/primes-count-100-000-000.txt
 100000000 primes/primes-count-100-000-000.txt
```

Perfect! We've split up the 100,000,000 prime number list into 20 separate 50MB files.

### Performance Considerations and Future Optimizations

Unfortunately, as I was finalizing this post to be published I noticed significant garbage collection thrashing when profiling the script.

Upon closer inspection I realized the `LineToNumber` implementation is the cause. Considering a default chunk size of 64KB with thousands of lines in it, the transform method allocates 3 objects per line (`slice`, `.toString()`, and `parseInt()`), and occasionally a 4th and 5th objects for `this.#prev`. For the 100,000,000 prime number list, the average line size is about 9 bytes, meaning that a 64KB chunk contains ~7,000 lines on average. This would result in every chunk allocating at least 21,000 objects! You can see this thrashing for yourself by using `--trace-gc` when executing the script (look for the `allocation failure` messages in the trace logs).

My first thought was to try and tweak `highWaterMark` options to reduce chunk sizes, but I was unable to find values that simultaneously prevented the thrashing and performed efficiently.

I've come to the conclusion that the only reasonable solution here is for different stream implementations; particularly, sticking to `Buffer` as much as possible rather than creating copies, encoding strings, and parsing numbers.

This post is already long enough (and it has taken me far longer to write than I originally thought), so stay tuned for a follow up post where I dive deeper into this problem and optimize these stream implementations.

## Conclusion

Custom stream implementations are one of the most fascinating and complicated parts of Node.js development.

Throughout writing this post, and figuring out these stream implementations, I learned the hard way how important it is to efficiently manage memory consumption, object references, and so much more.

I hope you've learned something beneficial about custom Node.js stream implementations, and stay tuned for more posts where I not only optimize these stream implementations more but also dig deeper into computational mathematics and create more efficient prime number generator!

If you enjoyed, make sure to share!
