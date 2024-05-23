import { YouTubeEmbed } from "./components/YouTubeEmbed";
import MountainTopImage from "@/images/mountain-top.jpg";
import books from "./books/books.json";
import talks from "./talks/talks.json";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";

const getChessStats = async () => {
  const res = await fetch("https://api.chess.com/pub/player/ethanarrowood/stats", { next: { revalidate: 30 } });

  if (!res.ok) {
    return null;
  }

  return res.json();
};

async function ChessStats({ shell = false }) {
  let chessStats: any;

  if (!shell) {
    chessStats = await getChessStats();
  }

  return (
    <>
      <li>Rapid: {chessStats?.chess_rapid.last.rating ?? "~1200"}</li>
      <li>Blitz: {chessStats?.chess_blitz.last.rating ?? "~900"}</li>
      <li>Daily: {chessStats?.chess_daily.last.rating ?? "~1000"}</li>
      <li>Bullet: {chessStats?.chess_bullet.last.rating ?? "~700"}</li>
    </>
  );
}

export default function Home() {
  return (
    <div className="flex flex-col gap-4">
      {/* Introduction */}
      <div>
        <span className="block sm:inline">
          <span role="img" aria-label="hand waving">
            👋
          </span>{" "}
          I&apos;m <h1 className="inline text-lg text-emerald-700">Ethan Arrowood</h1>, here are my highlights...
        </span>
        <span aria-hidden className="block sm:inline text-center sm:float-right text-emerald-700">
          ━━━━━━
        </span>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row pb-4 border-b-2 border-emerald-700">
        {/* Headshot */}
        <Image
          src={MountainTopImage}
          alt="Picture of me giving a talk at Node Conf EU"
          className="block m-auto w-2/3 rounded-xl sm:m-0 sm:w-1/3 sm:inline object-cover"
          placeholder="blur"
        />

        {/* Highlights */}
        <div className="flex flex-col gap-2">
          <ol className="relative border-s border-emerald-700">
            <li className="mb-8 ms-4">
              <div className="absolute w-3 h-3 bg-emerald-700 rounded-full mt-1.5 -start-1.5 border border-emerald-700"></div>
              <time className="mb-1 text-sm font-normal leading-none text-gray-400">February 2022 - Present</time>
              <h3 className="text-lg font-semibold text-gray-900">Vercel - Senior Software Engineer</h3>
              <p className="mb-4 text-base font-normal text-gray-500">Description</p>
            </li>
            <li className="mb-8 ms-4">
              <div className="absolute w-3 h-3 bg-emerald-700 rounded-full mt-1.5 -start-1.5 border border-emerald-700"></div>
              <time className="mb-1 text-sm font-normal leading-none text-gray-400">November 2019 - January 2022</time>
              <h3 className="text-lg font-semibold text-gray-900">Microsoft - Software Engineer II</h3>
              <p className="text-base font-normal text-gray-500">Description</p>
            </li>
            <li className="mb-8 ms-4">
              <div className="absolute w-3 h-3 bg-emerald-700 rounded-full mt-1.5 -start-1.5 border border-emerald-700"></div>
              <time className="mb-1 text-sm font-normal leading-none text-gray-400">January 2020 - December 2022</time>
              <h3 className="text-lg font-semibold text-gray-900">Digital Ready - Advisor</h3>
              <p className="text-base font-normal text-gray-500">Description</p>
            </li>

          <li className="ms-4">
              <div className="absolute w-3 h-3 bg-emerald-700 rounded-full mt-1.5 -start-1.5 border border-emerald-700"></div>
              <time className="mb-1 text-sm font-normal leading-none text-gray-400">September 2016 - August 2019</time>
              <h3 className="text-lg font-semibold text-gray-900">Wentworth Institute of Technology - B.S. Computer Science</h3>
              <p className="text-base font-normal text-gray-500">Description</p>
              <ol className="mt-4 border-s border-dashed border-emerald-700">
                <li className="mb-8 ms-4">
                  <div className="absolute w-3 h-3 bg-emerald-700 rounded-full mt-1.5 start-2.5 border border-emerald-700"></div>
                  <time className="mb-1 text-sm font-normal leading-none text-gray-400">July 2018 - December 2018</time>
                  <h3 className="text-lg font-semibold text-gray-900">Microsoft - Software Engineering Intern</h3>
                  <p className="text-base font-normal text-gray-500">Description</p>
                </li>
                <li className="ms-4">
                  <div className="absolute w-3 h-3 bg-emerald-700 rounded-full mt-1.5 start-2.5 border border-emerald-700"></div>
                  <time className="mb-1 text-sm font-normal leading-none text-gray-400">February 2018 - June 2018</time>
                  <h3 className="text-lg font-semibold text-gray-900">Griffith University - Study Abroad</h3>
                  <p className="text-base font-normal text-gray-500">Description</p>
                </li>
              </ol>
          </li>
          </ol>
          {/* <div className="flex flex-row gap-2">
            <p className="inline" role="img" aria-label="laptop">
              💻
            </p>
            <ul className="min-w-0">
              <li>
                <Link className="underline" href="https://vercel.com" target="_blank">
                  Vercel
                </Link>{" "}
                Senior Software Engineer
              </li>
              <li>
                <Link className="underline" href="https://nodejs.org" target="_blank">
                  Node.js
                </Link>{" "}
                Contributor
              </li>
              <li>
                <Link className="underline" href="https://github.com/nodejs/undici/" target="_blank">
                  Undici
                </Link>{" "}
                Maintainer
              </li>
              <li>
                <Link className="underline" href="https://tc39.es" target="_blank">
                  ECMA TC39
                </Link>{" "}
                Delegate
              </li>
              <li>
                <Link className="underline" href="https://openjsf.org" target="_blank">
                  OpenJS
                </Link>{" "}
                &{" "}
                <Link className="underline" href="https://wintercg.org" target="_blank">
                  WinterCG
                </Link>{" "}
                Collaborator
              </li>
              <li className="whitespace-nowrap text-ellipsis overflow-hidden">
                Developing{" "}
                <Link className="underline" href="https://github.com/Ethan-Arrowood/mddl" target="_blank">
                  mddl
                </Link>{" "}
                <span className="text-sm">(markdown documentation language)</span>
              </li>
            </ul>
          </div>
          <div className="flex flex-row gap-2">
            <p className="inline" role="img" aria-label="skis and boots">
              🎿
            </p>
            <ul>
              <li>Breckenridge Ski Instructor</li>
              <li>PSIA Alpine 1 & Freestyle 1 Certified</li>
              <li className="italic text-sm">Contact me for private lesson availability!</li>
            </ul>
          </div> */}
        </div>
      </div>

      {/* Posts */}
      {/* Coming soon! */}

      {/* Talks */}
      <div className="flex flex-col gap-2 pb-4 border-b-2 border-emerald-700">
        <p>
          <span role="img" aria-label="microphone">
            🎤
          </span>{" "}
          Talks
        </p>
        <div className="align-center m-auto flex flex-row flex-wrap justify-center gap-4">
          {talks.slice(0, 3).map((talk) => (
            <YouTubeEmbed key={talk.id} id={talk.id} />
          ))}
        </div>
      </div>

      {/* Hobbies */}
      <div className="flex flex-col justify-center gap-2">
        {/* Currently Reading */}
        <div className="flex flex-row gap-2 m-auto">
          <p className="inline" role="img" aria-label="stack of books">
            📚
          </p>
          <ul className="min-w-0">
            <li>Currently Reading</li>
            {books
              .filter((book) => book.shelf === "currently-reading")
              .map((book) => (
                <li className="whitespace-nowrap text-ellipsis overflow-hidden" key={book.title}>
                  <Link className="underline" href={book.goodreads_link} target="_blank">
                    {book.title}
                  </Link>{" "}
                  - <span className="italic text-sm">{book.author}</span>
                </li>
              ))}
          </ul>
        </div>

        {/* Sub-section for better alignment on medium screens */}
        <div className="flex flex-row justify-around">
          {/* Chess */}
          <div className="flex flex-row gap-2">
            <p className="inline" role="img" aria-label="chess piece (pawn)">
              ♟️
            </p>
            <ul>
              <li>
                <Link className="underline" href="https://www.chess.com/member/ethanarrowood" target="_blank">
                  chess.com
                </Link>{" "}
                Stats
              </li>
              <Suspense fallback={<ChessStats shell />}>
                <ChessStats />
              </Suspense>
            </ul>
          </div>

          {/* Lifting */}
          <div className="flex flex-row gap-2">
            <p className="inline">🏋️‍♂️</p>
            <ul>
              <li>Lifting PRs</li>
              <li>Deadlift: 315lbs</li>
              <li>Squat: 225lbs</li>
              <li>Press: 145lbs</li>
              <li>Clean: 145lbs</li>
              <li>Snatch: 125lbs</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
