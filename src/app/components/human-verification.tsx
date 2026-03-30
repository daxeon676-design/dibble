"use client";

import { useEffect, useRef } from "react";
import { useState } from "react";

type TurnstileOptions = {
  sitekey: string;
  callback?: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
};

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileOptions) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

type Props = {
  onTokenChange: (token: string | null) => void;
  resetSignal?: number;
};

function loadTurnstileScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Window unavailable"));
      return;
    }

    if (window.turnstile) {
      resolve();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>('script[src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"]');
    if (existing) {
      // If the script tag already exists, poll briefly for global readiness.
      const startedAt = Date.now();
      const checkReady = () => {
        if (window.turnstile) {
          resolve();
          return;
        }
        if (Date.now() - startedAt > 6000) {
          reject(new Error("Turnstile script present but API unavailable"));
          return;
        }
        window.setTimeout(checkReady, 100);
      };

      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Turnstile")), { once: true });
      checkReady();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Turnstile"));
    document.head.appendChild(script);
  });
}

export function HumanVerification({ onTokenChange, resetSignal = 0 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
    if (!siteKey || !containerRef.current) {
      onTokenChange(null);
      return;
    }

    setLoadError(null);

    let cancelled = false;

    void loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) {
          if (!cancelled) {
            setLoadError("Human verification failed to initialize. Please refresh and try again.");
          }
          return;
        }

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token) => onTokenChange(token),
          "expired-callback": () => onTokenChange(null),
          "error-callback": () => onTokenChange(null),
        });
      })
      .catch(() => {
        onTokenChange(null);
        setLoadError("Could not connect to Cloudflare Turnstile. Please disable blockers and refresh.");
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
  }, [onTokenChange, resetSignal]);

  if (!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim()) {
    return (
      <p className="text-sm text-red-500">
        Human verification is currently unavailable. Please contact support.
      </p>
    );
  }

  return (
    <div>
      <div ref={containerRef} />
      {loadError ? <p className="mt-2 text-sm text-red-500">{loadError}</p> : null}
    </div>
  );
}
