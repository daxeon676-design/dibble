"use client";

import { useState } from "react";

type Props = {
  sellerId: string;
  initiallyFollowing: boolean;
  initialFollowers: number;
};

export function FollowShopButton({ sellerId, initiallyFollowing, initialFollowers }: Props) {
  const [isFollowing, setIsFollowing] = useState(initiallyFollowing);
  const [followers, setFollowers] = useState(initialFollowers);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function toggleFollow() {
    setState("loading");

    const response = await fetch(`/api/seller/follow/${sellerId}`, {
      method: isFollowing ? "DELETE" : "POST",
    });

    if (response.status === 401) {
      window.location.href = `/login?callbackUrl=${encodeURIComponent(`/shop/${sellerId}`)}`;
      return;
    }

    const payload = (await response.json().catch(() => null)) as { followers?: number } | null;
    if (!response.ok) {
      setState("error");
      return;
    }

    setIsFollowing((prev) => !prev);
    setFollowers(payload?.followers ?? followers);
    setState("idle");
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggleFollow}
        disabled={state === "loading"}
        className="rounded-md border border-(--accent-terra) px-3 py-1 text-xs text-(--accent-terra) hover:bg-white/50 disabled:opacity-60"
      >
        {state === "loading" ? "Updating..." : isFollowing ? "Unfollow Shop" : "Follow Shop"}
      </button>
      <span className="text-xs text-foreground/60">{followers} follower{followers === 1 ? "" : "s"}</span>
    </div>
  );
}
