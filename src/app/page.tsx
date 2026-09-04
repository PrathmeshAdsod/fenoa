import { ArrowRight, GitBranch, Sparkles } from "lucide-react";
import Link from "next/link";

import { BranchCard } from "@/components/social/branch-card";
import { WorldCard } from "@/components/social/world-card";
import { listDiscovery } from "@/lib/server/world-repository";

export const dynamic = "force-dynamic";

type Discovery = Awaited<ReturnType<typeof listDiscovery>>;

function LandingPage() {
  return (
    <main className="landing-shell">
      <section className="landing-hero" aria-labelledby="landing-title">
        <p className="landing-kicker">A creative space for living fiction</p>
        <h1 id="landing-title">
          Create worlds.
          <br />
          Let stories branch.
        </h1>
        <p className="landing-lede">
          Fenoa is a creative space for building fictional worlds, developing
          them with AI, and opening them for new stories.
        </p>
        <p className="landing-detail">
          Characters, relationships, rules, secrets, and episodes stay connected
          as the world evolves.
        </p>
        <div className="landing-actions">
          <Link href="/create" className="button button-primary">
            Start creating <ArrowRight size={15} aria-hidden="true" />
          </Link>
          <Link href="/?view=discover" className="button button-quiet">
            Explore Fenoa
          </Link>
        </div>
      </section>

      <section id="product" className="landing-section landing-foundation">
        <div className="landing-section-intro">
          <span>01</span>
          <div>
            <p className="eyebrow">Build the foundation</p>
            <h2>Start with an idea, not a giant form.</h2>
          </div>
        </div>
        <div className="landing-section-body">
          <p>
            Begin with a premise, genre, and tone. Fenoa gives the idea a clear
            structure, while every part remains yours to edit.
          </p>
          <div className="landing-word-list" aria-label="World building parts">
            <span>Characters</span>
            <span>Relationships</span>
            <span>Rules</span>
            <span>Secrets</span>
            <span>Places</span>
            <span>Story Spark</span>
          </div>
        </div>
      </section>

      <section className="landing-section landing-ai">
        <div className="landing-section-intro">
          <span>02</span>
          <div>
            <p className="eyebrow">Creative Partner</p>
            <h2>Think with AI when you want to.</h2>
          </div>
        </div>
        <div className="landing-section-body landing-split-copy">
          <div>
            <p>
              You can build every part yourself. Or ask Fenoa to suggest a
              direction, challenge a weak idea, connect existing characters and
              facts, or help resolve a contradiction.
            </p>
            <p className="landing-control-note">
              AI is optional. The creator remains in control.
            </p>
          </div>
          <div className="landing-build-note">
            <strong>Build turns an accepted idea into the actual world.</strong>
            <p>
              The Creative Partner does more than chat. When you choose Build,
              it applies the direction to the structured World Canvas you are
              already editing.
            </p>
          </div>
        </div>
      </section>

      <section className="landing-section landing-remix">
        <div className="landing-section-intro">
          <span>03</span>
          <div>
            <p className="eyebrow">Remix</p>
            <h2>One world can become many stories.</h2>
          </div>
        </div>
        <div className="landing-section-body">
          <p>
            A published world becomes a stable foundation. A remix can continue
            it, follow another character, introduce someone new, change an
            important assumption, or build a short episodic arc. The original
            world remains unchanged.
          </p>
          <ul className="landing-simple-list">
            <li>Episodes that form a readable sequence</li>
            <li>Characters and truths that belong only to the remix</li>
            <li>Story locks that protect what must stay true</li>
          </ul>
        </div>
      </section>

      <section className="landing-section landing-webmcp">
        <div className="landing-section-intro">
          <span>04</span>
          <div>
            <p className="eyebrow">Human + agent</p>
            <h2>Your agent works on the story — not around it.</h2>
          </div>
        </div>
        <div className="landing-section-body">
          <p>
            Through native WebMCP, an external browser agent can understand the
            current creative state and work on the same world or remix the human
            is editing. When either side changes an episode or protects a story
            fact, the other sees the latest state and can continue from there.
          </p>
          <p className="landing-powered">Powered by native browser WebMCP.</p>
        </div>
      </section>

      <section className="landing-final">
        <p className="eyebrow">A simple creative loop</p>
        <h2>Create. Publish. Remix. Collaborate.</h2>
        <p>
          Begin with one idea. Shape it into a world people can enter, then see
          where another storyteller takes it.
        </p>
        <div className="landing-actions">
          <Link href="/create" className="button button-primary">
            Create your world <ArrowRight size={15} aria-hidden="true" />
          </Link>
          <Link href="/?view=discover" className="button button-quiet">
            Explore worlds
          </Link>
        </div>
      </section>

      <footer className="landing-footer">
        <strong>Fenoa</strong>
        <span>Worlds worth branching.</span>
      </footer>
    </main>
  );
}

function DiscoverPage({ worlds, branches, profiles }: Discovery) {
  return (
    <main className="discover-shell">
      <header className="discover-heading">
        <p className="eyebrow">Discover</p>
        <h1>Worlds to enter. Stories to continue.</h1>
        <p>
          Explore published worlds and the remixes growing from them. Everything
          here was created and published by the Fenoa community.
        </p>
      </header>

      <section className="discover-section" aria-labelledby="worlds-title">
        <div className="discover-section-heading">
          <div>
            <p className="eyebrow">Published worlds</p>
            <h2 id="worlds-title">Choose a world</h2>
          </div>
          <Link href="/create" className="text-action">
            Create a world <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
        {worlds.length ? (
          <div className="world-card-grid" aria-label="Published worlds">
            {worlds.map((world) => (
              <WorldCard
                key={world.id}
                world={world}
                creator={profiles.get(world.creatorId)}
              />
            ))}
          </div>
        ) : (
          <p className="social-empty">
            No worlds are published yet. Be the first to create one.
          </p>
        )}
      </section>

      <section className="discover-section discover-remixes">
        <div className="discover-section-heading">
          <div>
            <p className="eyebrow">Community remixes</p>
            <h2>Stories taking another path</h2>
          </div>
          <span>
            <GitBranch size={14} aria-hidden="true" /> Ranked by real likes
          </span>
        </div>
        {branches.length ? (
          <div className="branch-card-grid">
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
            <Sparkles size={16} aria-hidden="true" /> Community remixes appear
            after creators publish them.
          </div>
        )}
      </section>
    </main>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  if (view !== "discover") return <LandingPage />;

  const discovery = await listDiscovery();
  return <DiscoverPage {...discovery} />;
}
