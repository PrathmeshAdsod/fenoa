import { ArrowRight, GitBranch, LockKeyhole, Sparkles } from "lucide-react";
import Link from "next/link";

const branchId =
  process.env.NEXT_PUBLIC_NIGHTFALL_BRANCH_ID ?? "nightfall-fragments";

export default function Home() {
  return (
    <main>
      <section className="hero">
        <div className="hero-art" aria-hidden="true">
          <div className="moon" />
          <div className="city-line city-line-back" />
          <div className="city-line city-line-front" />
          <span className="time-mark">2:17</span>
        </div>
        <div className="hero-copy">
          <p className="eyebrow">Featured world · supernatural noir</p>
          <h1>Every night, seventeen minutes disappear.</h1>
          <p className="hero-premise">
            In Nightfall, memory fractures at 2:17 AM. The cameras die. The city
            forgets. One man remembers enough to be afraid.
          </p>
          <div className="hero-actions">
            <Link
              href={`/studio/${branchId}`}
              className="button button-primary"
            >
              Enter the branch <ArrowRight size={16} />
            </Link>
            <span>Created by Fenoa</span>
          </div>
        </div>
      </section>

      <section className="thesis-section">
        <p className="eyebrow">A possibility space, not a fixed canon</p>
        <h2>Keep what matters. Change what could have been.</h2>
        <div className="thesis-points">
          <article>
            <GitBranch />
            <h3>Branch the story</h3>
            <p>Remix a world or another remix without changing its history.</p>
          </article>
          <article>
            <LockKeyhole />
            <h3>Protect decisions</h3>
            <p>
              Lock secrets, relationships, appearances, and unresolved
              mysteries.
            </p>
          </article>
          <article>
            <Sparkles />
            <h3>Create with your agent</h3>
            <p>
              Humans and browser agents act on the same living branch through
              native WebMCP.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
