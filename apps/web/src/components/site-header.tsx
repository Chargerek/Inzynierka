"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/features/auth/auth-context";
import type { UserRole } from "@/lib/types";

type NavItem = {
  href: string;
  label: string;
};

const ROLE_LABELS: Record<UserRole, string> = {
  patient: "Pacjent",
  dermatologist: "Lekarz",
  admin: "Administrator",
};

const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  patient: [
    { href: "/panel", label: "Mój panel" },
    { href: "/cennik", label: "Cennik" },
  ],
  dermatologist: [
    { href: "/doctor", label: "Kalendarz" },
  ],
  admin: [
    { href: "/admin", label: "Administracja" },
    { href: "/cennik", label: "Cennik" },
  ],
};

const PUBLIC_NAV: NavItem[] = [
  { href: "/cennik", label: "Cennik" },
  { href: "/login", label: "Logowanie" },
];

export function SiteHeader() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const items = user ? NAV_BY_ROLE[user.role] : PUBLIC_NAV;

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  return (
    <header className="border-b border-zinc-200 bg-gray-100">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-4">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-zinc-900"
        >
          Gabinet Dermatologiczny
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {items.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-2 font-medium transition-colors ${
                  active
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          {user ? (
            <>
              <span className="ml-2 hidden text-zinc-500 sm:inline">
                {user.first_name} {user.last_name}
                <span className="ml-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                  {ROLE_LABELS[user.role]}
                </span>
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="ml-2 rounded-md border border-zinc-300 px-3 py-2 font-medium text-zinc-700 
                transition-colors hover:bg-white hover:text-zinc-900 hover:shadow-sm"
              >
                Wyloguj
              </button>
            </>
          ) : (
            <Link
              href="/rejestracja"
              className="ml-2 rounded-md border border-zinc-300 bg-white px-3 py-2 font-medium text-zinc-900 transition-colors hover:bg-zinc-100"
            >
              Rejestracja
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
