"use client";

import { signOut } from "next-auth/react";

export function SignOutButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/" })}
      className={
        className ?? "rounded border border-(--accent-terra) px-2 py-1 text-xs text-(--accent-terra)"
      }
    >
      Sign Out
    </button>
  );
}
