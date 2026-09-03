"use client";

import { Heart } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { domainClient } from "@/lib/client/domain-client";

export function LikeButton({
  branchId,
  initialCount,
}: {
  branchId: string;
  initialCount: number;
}) {
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);

  useEffect(() => {
    const version = ++requestVersion.current;
    const controller = new AbortController();
    setLiked(false);
    setCount(initialCount);
    setBusy(false);
    setError(null);
    domainClient
      .getBranchLike(branchId, controller.signal)
      .then((result) => {
        if (requestVersion.current === version) setLiked(result.liked);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [branchId, initialCount]);

  async function toggle() {
    const version = ++requestVersion.current;
    setBusy(true);
    setError(null);
    try {
      const result = await domainClient.setBranchLike(branchId, !liked);
      if (requestVersion.current === version) {
        setLiked(result.liked);
        setCount(result.likeCount);
      }
    } catch (caught) {
      if (requestVersion.current === version) {
        setError(
          caught instanceof Error ? caught.message : "Like unavailable.",
        );
      }
    } finally {
      if (requestVersion.current === version) setBusy(false);
    }
  }

  return (
    <div className="like-control">
      <button
        className={`button button-quiet ${liked ? "liked" : ""}`}
        disabled={busy}
        onClick={() => void toggle()}
      >
        <Heart size={15} fill={liked ? "currentColor" : "none"} /> {count}
      </button>
      {error ? <small>{error}</small> : null}
    </div>
  );
}
