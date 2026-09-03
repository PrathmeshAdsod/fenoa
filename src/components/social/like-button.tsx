"use client";

import { Heart } from "lucide-react";
import { useEffect, useState } from "react";

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

  useEffect(() => {
    const controller = new AbortController();
    domainClient
      .getBranchLike(branchId, controller.signal)
      .then((result) => setLiked(result.liked))
      .catch(() => undefined);
    return () => controller.abort();
  }, [branchId]);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const result = await domainClient.setBranchLike(branchId, !liked);
      setLiked(result.liked);
      setCount(result.likeCount);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Like unavailable.");
    } finally {
      setBusy(false);
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
