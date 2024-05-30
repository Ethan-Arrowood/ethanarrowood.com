"use client";

import { CodeBracketIcon } from "@heroicons/react/20/solid";
import { usePathname } from "next/navigation";
import Link from "next/link";

export default function Navbar() {
  const pathname = usePathname();
  const routes = [
    {
      text: "home",
      href: "/",
    },
  ];
  return (
    <header>
      <nav
        className="flex items-center justify-between border-b-2 border-emerald-700 px-2 py-4 font-semibold text-gray-900"
        aria-label="Global navigation"
      >
        <div className="flex flex-1 gap-x-4 ">
          {routes.map((route) => {
            const isActive = pathname === route.href;
            return (
              <Link key={route.href} href={route.href} className={isActive ? "text-emerald-700 underline" : ""}>
                {route.text}
              </Link>
            );
          })}
        </div>
        <div className="flex-end flex">
          <span className="text-2xl">
            <Link href="https://github.com/ethan-arrowood/ethanarrowood.com" target="_blank">
              <CodeBracketIcon className="h-5 w-5" />
            </Link>
          </span>
        </div>
      </nav>
    </header>
  );
}
