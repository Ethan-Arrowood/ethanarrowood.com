import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import Footer from "./footer";
import "./globals.css";
import Navbar from "./navbar";

export const metadata: Metadata = {
  title: "Ethan Arrowood",
  description:
    "Personal website for Ethan Arrowood. Avid adventurer. Open source maintainer. Vercel Senior Software Engineer. Node.js Contributor. ECMA TC39 Delegate. Breckenridge Ski Instructor.",
  icons:
    "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🏔️</text></svg>",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-gray-100">
      <body className="mx-auto flex h-screen flex-col gap-4 px-2 sm:max-w-screen-sm md:max-w-screen-md lg:max-w-screen-lg">
        <Navbar />
        {children}
        <Footer />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
