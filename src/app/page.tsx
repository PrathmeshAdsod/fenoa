import { ArrowRight, GitBranch, Sparkles } from "lucide-react";
import Link from "next/link";

import { BranchCard } from "@/components/social/branch-card";
import { WorldCard } from "@/components/social/world-card";
import { listDiscovery } from "@/lib/server/world-repository";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { worlds, branches, profiles } = await listDiscovery();
  const featured = worlds.find((world) => world.coverImage) ?? worlds[0];

  return (
    <main className="discovery-shell">
      {featured ? (
        <section
          className={`discovery-hero ${featured.coverImage ? "has-image" : ""}`}
          style={
            featured.coverImage
              ? { backgroundImage: `url("${featured.coverImage.url}")` }
              : undefined
          }
        >
          <div className="discovery-hero-shade" />
          <div className="discovery-hero-copy">
            <p className="eyebrow">Featured world · {featured.genre}</p>
            <h1>{featured.name}</h1>
            <p>{featured.premise}</p>
            <div>
              <Link
                href={`/world/${featured.id}`}
                className="button button-primary"
              >
                Enter this world <ArrowRight size={16} />
              </Link>
              <span>
                By{" "}
                {profiles.get(featured.creatorId)?.displayName ??
                  "Fenoa creator"}
              </span>
            </div>
          </div>
        </section>
      ) : (
        <section className="discovery-hero discovery-empty-hero">
          <div className="discovery-hero-copy">
            <p className="eyebrow">Fictional possibility spaces</p>
            <h1>Create a world worth branching.</h1>
            <p>
              The first published world will lead discovery here. Fenoa does not
              invent engagement or placeholder communities.
            </p>
            <Link href="/create" className="button button-primary">
              Create the first world <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      )}

      <section className="discovery-section">
        <div className="discovery-section-heading">
          <div>
            <p className="eyebrow">Published possibility spaces</p>
            <h2>Worlds asking to be explored</h2>
          </div>
          <div className="discovery-heading-actions">
            {worlds.length > 1 ? <span>Scroll the gallery →</span> : null}
            <Link href="/create">
              Create a world <ArrowRight size={14} />
            </Link>
          </div>
        </div>
        {worlds.length ? (
          <div className="world-card-row" aria-label="Published worlds">
            {worlds.map((world) => (
              <WorldCard
                key={world.id}
                world={world}
                creator={profiles.get(world.creatorId)}
              />
            ))}
          </div>
        ) : (
          <p className="social-empty">No worlds are published yet.</p>
        )}
      </section>

      <section className="discovery-section remix-discovery">
        <div className="discovery-section-heading">
          <div>
            <p className="eyebrow">Top community branches</p>
            <h2>Possibilities readers kept</h2>
          </div>
          <span>
            <GitBranch size={15} /> Ranked by real likes
          </span>
        </div>
        {branches.length ? (
          <div className="branch-card-row">
            {branches.map((branch) => (
              <BranchCard
                key={branch.id}
                branch={branch}
                creator={profiles.get(branch.creatorId)}
              />
            ))}
          </div>
        ) : (
          <div className="social-empty with-icon">
            <Sparkles size={18} /> Community branches will appear after creators
            publish them.
          </div>
        )}
      </section>
    </main>
  );
}
