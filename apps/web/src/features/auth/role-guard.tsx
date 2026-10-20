"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useAuth } from "@/features/auth/auth-context";
import type { UserRole } from "@/lib/types";

const HOME_BY_ROLE: Record<UserRole, string> = {
  patient: "/panel",
  dermatologist: "/doctor",
  admin: "/admin",
};

type RoleGuardProps = {
  roles: UserRole[];
  children: ReactNode;
};

export function RoleGuard({ roles, children }: RoleGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!roles.includes(user.role)) {
      router.replace(HOME_BY_ROLE[user.role]);
    }
  }, [user, loading, roles, router]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-zinc-500">
        Ładowanie…
      </div>
    );
  }

  if (!user || !roles.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
}
