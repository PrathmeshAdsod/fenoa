import { ArrowUpRight, Heart, Sparkles } from "lucide-react";
import Link from "next/link";

import type { PublishedBranch, PublicProfile } from "@/lib/contracts/world";

export function BranchCard({
  branch,
  creator,
  creatorPick = false,
}: {
  branch: PublishedBranch;
  creator?: PublicProfile | null;
  creatorPick?: boolean;
}) {
  return (
    <Link href={`/branch/${branch.id}`} className="branch-card">
      <div className="branch-card-kicker">
        <span>{branch.episodeCount} short episodes</span>
        <ArrowUpRight size={16} />
      </div>
      {creatorPick ? (
        <span className="creator-pick-mark">
          <Sparkles size={13} /> Creator Pick
        </span>
      ) : null}
      <h3>{branch.title}</h3>
      <p>{branch.creativeIntent}</p>
      <div className="branch-card-meta">
        <span>By {creator?.displayName ?? "Fenoa creator"}</span>
        <span>
          <Heart size={13} /> {branch.likeCount}
        </span>
      </div>
    </Link>
  );
}
