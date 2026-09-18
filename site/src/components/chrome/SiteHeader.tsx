import Link from "next/link";

import { Mark } from "@/components/ui/Mark";
import { ConnectControl } from "./ConnectControl";

const LINKS = [
  { href: "/board", label: "Board" },
  { href: "/launch", label: "Launch" },
  { href: "/dashboard", label: "Yours" },
  { href: "/learn", label: "How it works" },
];

export function SiteHeader() {
  return (
    <header className="border-b-2 border-signal/30 bg-ground-deep">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 text-ink" aria-label="Quadpad, home">
          <Mark size={30} />
          <span className="font-display text-lg tracking-tight text-lane">QUADPAD</span>
        </Link>

        <nav className="ml-auto hidden items-center gap-1 sm:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="micro px-2.5 py-2 font-semibold text-lane-soft transition-colors hover:text-signal"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto sm:ml-0">
          <ConnectControl />
        </div>
      </div>

      <nav className="flex items-center gap-1 overflow-x-auto border-t border-signal/20 px-4 py-1.5 sm:hidden">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="micro shrink-0 px-2.5 py-1.5 font-semibold text-lane-soft"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
