---
layout: ../../layouts/PostLayout.astro
title: "Primes, Streams, and Really Large Files"
pubDate: 2025-11-02T12:00:00-06:00
editDate: 2025-11-02T12:00:00-06:00
description: ""
---

## Precursor

Math has always fascinated me, especially when it intersects with programming. Relatively recently, I started working through the [Project Euler](https://projecteuler.net/) problem set to sharpen both my computational mathematics skills. As an added challenge, I avoid using any third-party libraries when solving these problems limiting myself to the standard JavaScript `Math` API and whatever I can build from scratch. My overall goal is not just to solve the problems, but also to deeply understand them, the underlying concepts, and even work through potential optimizations both mathematically and algorithmically.

> This post does not contain any Project Euler solutions, but it is not technically 100% spoiler-free.
> 
> It includes some utility functions I created to solve problems, a small hint to problem 5, and briefly discusses the extremely-inefficient, naive solution concept for problem 41.
>
> This information is only provided from a story-telling perspective in order to explain why and how I wound up with a large file of prime numbers!
> 
> Other than the specific details above, there are no other Project Euler spoilers in this post. Enjoy!


## Prime Number Utilities

As of writing this post, I've solved only about 40 problems from the set of over 900. Throughout these early problems, the concept of prime numbers has appeared frequently. For example, the 3rd problem, [Largest prime factor](https://projecteuler.net/problem=3), asks for the largest prime factor of a large number, and the 7th problem, [10001st Prime](https://projecteuler.net/problem=7), simply asks what is the $10001$st prime number? The thing with primes is that they are just fundamental to so much of mathematics they start popping up even when not directly mentioned by the problem. For example, the 5th problem, [Smallest Multiple](https://projecteuler.net/problem=5), asks to determine the smallest positive number that is evenly divisible by all the numbers from 1 to 20. Without giving too much away, there is a really useful trick to solving this problem when you consider how divisibility and prime factorization are related. Clearly, primes are important for mathematical and computational problem solving.

As I worked through various problems requiring prime numbers, I started creating my own set of prime number utilities. Starting with relatively the most important function, `isPrime(n)`, for determining if a number `n` is a prime or not:

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

> I acknowledge this is **not** the most efficient way to validate a prime number, but once again, my main goal is simply to refine my computational mathematics skills. If I ever needed the _most efficient_ solution I would absolutely consider third-party resources.

Initially, this method was simple enough to solve the early problems. During runtime, I could iterate over a range, check if a given number is prime, and then do whatever additional logic necessary for solving the problem at hand. I knew this was inefficient, and so I quickly turned to my favorite dynamic programming concept, memoization, to improve my utility methods.

Instead of computing primes during the runtime of any given problem solution, I decided to generate a set of prime numbers ahead of time, save that to a file, and then have my solutions use the set directly.

Equipped with my naive `isPrime()` function, and the power of JavaScript [generators](), I came up with this solution:

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

But also, I could use this generator along with some Node.js [Stream]() and [File System]() APIs to generate a `primes.txt` file:

```typescript
await pipeline(
  primeGenerator({ count: 100_000 }),
  new Transform({
    objectMode: true,
    transform(chunk, encoding, callback) {
      callback(null, chunk ? `${chunk}\n` : chunk);
    },
  }),
  createWriteStream('primes.txt'),
);
```

While this implementation is not the fastest way to generate primes, because it uses a generator, it could at least efficiently generate essentially infinite values without ever running out of memory. For the relatively low count of one-hundred thousand prime numbers, this script runs in 0.25 seconds on my M1 Macbook Pro and generates a 708KB file.

```
❯ time node generatePrimes.ts 
  node generatePrimes.ts  0.29s user 0.02s system 125% cpu 0.250 total
❯ du -h primes.txt
  708K    primes.txt
```

> I verified the correctness of my utilities by comparing my `primes.txt` output to the [OEIS A000040 integer sequence](https://oeis.org/A000040).

Now throughout my solutions, instead of generating primes on the fly, I can read the file into memory and use the data however necessary:

```typescript
const primes = readFileSync('primes.txt', 'utf-8');

const primeArray = primes
		.trim()
		.split('\n')
		.map((n) => parseInt(n)),

for (const prime of primeArray) {
  // 2, 3, 5, 7, 11, ...
}

primeArray[99] // the 100th prime number is ...

const primeSet = new Set(primeArray);

primeSet.has(123) // equivalent `isPrime(123)` check
```

> There is still some performance overhead to reading the file and then doing operations like `split()` and `map()`, but it is significantly faster compared to computing primes at runtime.

## From the 100,000th Prime to all Primes less than 2,000,000

Throughout most of the early problems, 100,000 prime numbers was plenty. When I eventually got to problem 10, [Summation of Primes](), it wanted the sum of all prime numbers below two million. Now the 100,000th prime number is only 1,299,709 so my pre-computed set was clearly not large enough. So lets generate a new set with `limit: 2_000_000` instead of `count: 100_000`:

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

## Primes less than 1,000,000,000

Fast-forward to problem 41, [Pandigital Prime]():

> We shall say that an $n$-digit number is pandigital if it makes use of all the
digits $1$ to $n$ exactly once. For example, $2143$ is a $4$-digit pandigital
and is also prime.
>
> What is the largest $n$-digit pandigital prime that exists?

As I mentioned at the beginning of the post, in the spirit of Project Euler, I will **not** discuss the solution too much, but hopefully the extremely-inefficient, naive solution is obvious enough. In order to find the _largest_, we have to check all prime numbers up to 9-digits long.

> This problem is actually a really fun one to consider shortcuts and optimizations for. In the spirit of Project Euler I'll leave those as exercises to the reader. Good luck!

Anyways, for the naive solution, I went back to my prime number generator script and changed the limit to 1,000,000,000 since I needed all prime numbers up to 9-digits long.

```typescript
primeGenerator({ limit: 1_000_000_000 })
```

This time it took nearly half-an-hour to execute, and the resulting text file is 480MB! My dev tools, VS Code and Git, can still handle this file size okay with only a little bit of lag. Something as simple as `git add primes-limit-1-000-000-000.txt` takes a few seconds now instead of the relatively-instantaneous few milliseconds.

And using `wc` and `tail` again, it turns out 999,999,937 is the 50,847,534th prime number and the largest 9-digit prime number.

```
❯ wc -l primes-limit-1-000-000-000.txt
  50847534 primes-limit-1-000-000-000.txt
❯ tail -n 1 primes-limit-1-000-000-000.txt
  999999937
```

## The 100,000,000th Prime Number

So now I'm just curious, what is the 100,000,000th prime number?

After updating my generator back to using `count`:

```typescript
primeGenerator({ count: 100_000_000 })
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

944MB, nearly an entire gigabyte! VS Code is nearly crashing trying to open this file, and git is completely timing out in my shell. In my project, I have prettier, husky, and lint-staged set up to do some automatic formatting on commit and this process completely breaks due to the size of the file. I'm not sure which tool can't handle it, but the point is nearly a gigabyte in size is just too large!

## Cleaning up my mess

Curiosity killed the cat, scratch your own itch, pick whatever idiom you want, but now I have a file nearly a gigabyte in size containing 100,000,000 prime numbers that is breaking my dev tools. Now, I could just delete it and downsize to something a bit more reasonable, maybe reverting to the 1,000,000,000 limit? But maybe I'll need all these prime numbers some day! And I already spent the electricity to generate it; it wouldn't be very eco-friendly of me to just delete it now.

So I started thinking (and procrastinating working on the next Project Euler problem), Node.js streams and a memory-safe generator got me into this mess, could I use these same APIs to first split the file up into multiple, smaller files, and then second, create an efficient interface for interacting with the multiple files?

I don't want to overly-abstract this, but 1GB is not really that impossibly large. Node.js has a default heap memory limit of 2GB so even at this size I could read the entire file into memory during runtime. But as a programmer, how could I possibly be satisfied with only solving my immediate problem?

I say that sarcastically, but there is actually some truth to thinking in abstractions. Consider what a _file_ really represents; it is a collection of data. Now at least in these circumstances (computational mathematics and data processing), its not the "file" I care about, but the data inside of it. And what is the most efficient way to interface with the data of a file? A **stream**!

So, for this solution, its not exactly just "splitting up one file into many", but instead "efficiently store a large data stream". If the solution solves for a input stream from the start, then not only could I use it on the large file of prime numbers, but I could also pass any stream-compatible data generator to it too!

Now this is starting to sound like the introduction to a database textbook, but this is where balancing abstractions with reality is important. All I really care about is a list of numbers. Compared to say structured or relational data, my current problem space is significantly simplified. And that is okay; 