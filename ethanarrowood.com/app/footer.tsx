import GitHubLogoDark from "@/images/logos/github/github-dark.png";
import XLogoDark from "@/images/logos/x/x-dark.png";
import { HeartIcon } from "@heroicons/react/20/solid";
import Image from "next/image";
import Link from "next/link";

const socials = [
  {
    name: "github",
    href: "https://github.com/ethan-arrowood",
    logo: {
      src: GitHubLogoDark,
      alt: "GitHub Logo",
    },
  },
  {
    name: "x",
    href: "https://x.com/Arrowood-Tech",
    logo: {
      src: XLogoDark,
      alt: "X (Twitter) Logo",
    },
  },
];

export default function Footer() {
  return (
    <footer className="flex items-center border-t-2 border-emerald-700 px-2 py-4">
      <div className="flex flex-1 flex-row gap-2">
        {socials.map((social) => (
          <p key={social.name}>
            <Link href={social.href} target="_blank">
              <Image className="h-6 w-6" src={social.logo.src} alt={social.logo.alt} />
            </Link>
          </p>
        ))}
      </div>
      <p className="flex-end inline-flex items-center">
        Made with <HeartIcon className="mx-1 inline-block h-5 w-5" /> by Ethan
      </p>
    </footer>
  );
}
