"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/decks/new", label: "Forge Quiz" },
  { href: "/party/join", label: "Join Party" },
  { href: "/how-it-works", label: "Leaderboard" },
  { href: "/pricing", label: "Pricing" },
  { href: "/achievements", label: "Guild Achievements" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}

export default function NavLinks() {
  const pathname = usePathname() ?? "/";
  return NAV_LINKS.map((item) => {
    const active = isActive(pathname, item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        className="nav-link"
        aria-current={active ? "page" : undefined}
      >
        {item.label}
      </Link>
    );
  });
}
