import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LikeButton } from "@/components/social/like-button";
import { RemixAction } from "@/components/social/remix-action";
import { ReportAction } from "@/components/social/report-action";
import { DomainError } from "@/lib/domain/errors";
import { getPublishedBranch } from "@/lib/server/world-repository";

export const dynamic = "force-dynamic";

export default async function BranchPage({
  params,
}: {
  params: Promise<{ branchId: string }>;
}) {
  const { branchId } = await params;
  let data: Awaited<ReturnType<typeof getPublishedBranch>>;
  try {
    data = await getPublishedBranch(branchId);
  } catch (error) {
    if (error instanceof DomainError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
  const state = data.revision.state;
  return (
    <main className="branch-page">
      <header className="branch-page-header">
        <div>
          <p className="eyebrow">
            A remix of{" "}
            <Link href={`/world/${data.world.id}`}>{data.world.name}</Link>
          </p>
          <h1>{data.branch.title}</h1>
          <p>{data.branch.creativeIntent}</p>
        </div>
        <div className="branch-public-actions">
          <LikeButton
            branchId={branchId}
            initialCount={data.branch.likeCount}
          />
          {data.world.remixEnabled ? (
            <RemixAction
              sourceType="branch"
              sourceId={branchId}
              sourceName={data.branch.title}
            />
          ) : (
            <span>Remixes are closed</span>
          )}
        </div>
      </header>
      <nav className="lineage-strip" aria-label="Remix lineage">
        <Link href={`/world/${data.world.id}`}>
          <span>Original world</span>
          <strong>{data.world.name}</strong>
        </Link>
        <ArrowRight size={15} />
        {data.parent ? (
          <>
            <Link href={`/branch/${data.parent.id}`}>
              <span>Parent remix</span>
              <strong>{data.parent.title}</strong>
            </Link>
            <ArrowRight size={15} />
          </>
        ) : null}
        <div>
          <span>This branch</span>
          <strong>{data.branch.title}</strong>
        </div>
      </nav>
      <section className="public-episode-sequence">
        <div className="world-detail-heading">
          <span>01</span>
          <div>
            <p className="eyebrow">Branch sequence</p>
            <h2>{state.episodes.length} short episodes</h2>
          </div>
        </div>
        {state.episodes.map((episode) => (
          <article key={episode.id}>
            <span>{String(episode.position).padStart(2, "0")}</span>
            <div>
              <h3>{episode.title}</h3>
              <p className="episode-hook-public">{episode.hook}</p>
              {episode.narrative ? (
                <p className="episode-narrative">{episode.narrative}</p>
              ) : null}
            </div>
          </article>
        ))}
      </section>
      <section className="public-branch-context">
        <div className="inherited-public">
          <p className="eyebrow">Inherited</p>
          <h2>The ground this branch keeps</h2>
          <p>{state.branch.inheritedSummary}</p>
          <small>World revision {state.branch.baseWorldRevisionId}</small>
        </div>
        <div className="changed-public">
          <p className="eyebrow">Changed here</p>
          <h2>What this branch makes its own</h2>
          {state.branch.addedCharacters.map((character) => (
            <article key={character.id}>
              <span>Added character</span>
              <strong>{character.name}</strong>
              <p>{character.role}</p>
            </article>
          ))}
          {state.branch.ruleOverrides.map((fact) => (
            <article key={fact.id}>
              <span>{fact.category.replaceAll("_", " ")}</span>
              <strong>{fact.statement}</strong>
            </article>
          ))}
          {!state.branch.addedCharacters.length &&
          !state.branch.ruleOverrides.length ? (
            <p>This path changes the sequence without adding cast or rules.</p>
          ) : null}
        </div>
        <div className="locks-public">
          <p className="eyebrow">Protected decisions</p>
          <h2>Locks carried by the branch</h2>
          <ul>
            {[
              ...state.branch.inheritedConstraints,
              ...state.branch.constraints,
            ].map((constraint) => (
              <li key={constraint.id}>
                <Sparkles size={13} />
                <span>
                  <strong>{constraint.label}</strong>
                  {constraint.description}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <footer className="content-trust-row">
        <span>
          By{" "}
          {data.creator ? (
            <Link href={`/u/${data.creator.id}`}>
              {data.creator.displayName}
            </Link>
          ) : (
            "Fenoa creator"
          )}{" "}
          · revision {data.branch.currentRevisionId.slice(0, 8)}
        </span>
        <ReportAction targetType="branch" targetId={branchId} />
      </footer>
    </main>
  );
}
