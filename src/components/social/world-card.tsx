import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import type { PublicProfile, PublishedWorld } from "@/lib/contracts/world";

export function WorldCard({
  world,
  creator,
}: {
  world: PublishedWorld;
  creator?: PublicProfile | null;
}) {
  return (
    <Link href={`/world/${world.id}`} className="world-card">
      <div
        className={`world-card-art ${world.coverImage ? "has-image" : ""}`}
        style={
          world.coverImage
            ? { backgroundImage: `url("${world.coverImage.url}")` }
            : undefined
        }
      >
        <span>{world.genre}</span>
        <ArrowUpRight size={18} />
      </div>
      <div className="world-card-copy">
        <h3>{world.name}</h3>
        <p>{world.premise}</p>
        <small>
          By {creator?.displayName ?? "Fenoa creator"} · {world.remixCount}{" "}
          {world.remixCount === 1 ? "remix" : "remixes"}
        </small>
      </div>
    </Link>
  );
}
