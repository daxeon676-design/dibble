"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ConsentChoice = "accepted" | "rejected";

type ConsentRecord = {
  choice: ConsentChoice;
  timestamp: string;
  version: string;
};

const STORAGE_KEY = "dibble_cookie_consent";
const CONSENT_COOKIE = "dibble_cookie_consent";
const CONSENT_VERSION = "2026-03";

function readConsent(): ConsentRecord | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as ConsentRecord;
    if (!parsed.choice || !parsed.timestamp || !parsed.version) return null;
    return parsed;
  } catch {
    return null;
  }
}

function persistConsent(record: ConsentRecord) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));

  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${CONSENT_COOKIE}=${record.choice}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
}

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const existing = readConsent();
      if (!existing || existing.version !== CONSENT_VERSION) {
        setVisible(true);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const currentDateLabel = useMemo(
    () => new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" }),
    [],
  );

  if (!visible) return null;

  function handleChoice(choice: ConsentChoice) {
    const record: ConsentRecord = {
      choice,
      timestamp: new Date().toISOString(),
      version: CONSENT_VERSION,
    };

    persistConsent(record);
    setVisible(false);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-300 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-slate-900">Cookie preferences</p>
          <p className="mt-1 text-sm text-slate-700">
            We use essential cookies to keep Dibble secure and to maintain your signed-in session.
            Optional analytics cookies are off by default and will only be enabled if you accept.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Last reviewed: {currentDateLabel}. Read our{" "}
            <Link href="/cookies" className="underline hover:text-slate-700">
              Cookie Policy
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline hover:text-slate-700">
              Privacy Policy
            </Link>
            .
          </p>
        </div>

        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap md:justify-end">
          <button
            type="button"
            onClick={() => handleChoice("rejected")}
            className="w-full rounded border border-slate-400 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 sm:w-auto"
          >
            Reject non-essential
          </button>
          <button
            type="button"
            onClick={() => handleChoice("accepted")}
            className="w-full rounded bg-(--accent-terra) px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 sm:w-auto"
          >
            Accept non-essential cookies
          </button>
        </div>
      </div>
    </div>
  );
}
