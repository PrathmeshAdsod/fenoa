import { ArrowRight, GitBranch, MapPin, Sparkles } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BranchCard } from "@/components/social/branch-card";
import { CreatorPickButton } from "@/components/social/creator-pick-button";
import { RemixAction } from "@/components/social/remix-action";
import { ReportAction } from "@/components/social/report-action";
import { DomainError } from "@/lib/domain/errors";
import { optionalUser } from "@/lib/server/auth";
import { getPublishedWorld } from "@/lib/server/world-repository";

export const dynamic = "force-dynamic";

export default async function WorldPage({
  params,
}: {
  params: Promise<{ worldId: string }>;
}) {
  const { worldId } = await params;
  let data: Awaited<ReturnType<typeof getPublishedWorld>>;
  try {
    data = await getPublishedWorld(worldId);
  } catch (error) {
    if (error instanceof DomainError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
  const user = await optionalUser();
  const isCreator = user?.uid === data.world.creatorId;
  const characterNames = new Map(
    data.revision.characters.map((character) => [character.id, character.name]),
  );

  return (
    <main className="world-page">
      <section
        className={`world-page-hero ${data.world.coverImage ? "has-image" : ""}`}
        style={
          data.world.coverImage
            ? { backgroundImage: `url("${data.world.coverImage.url}")` }
            : undefined
        }
      >
        <div className="world-page-shade" />
        <div className="world-page-hero-copy">
          <p className="eyebrow">
            {data.world.genre} · {data.world.tone}
          </p>
          <h1>{data.world.name}</h1>
          <p>{data.world.premise}</p>
          <div className="world-page-actions">
            {data.world.remixEnabled ? (
              <RemixAction
                sourceType="world"
                sourceId={data.world.id}
                sourceName={data.world.name}
              />
            ) : (
              <span>Remixes are closed</span>
            )}
            {data.creator ? (
              <Link href={`/u/${data.creator.id}`}>
                Created by {data.creator.displayName} <ArrowRight size={13} />
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="world-detail-lede">
        <div>
          <p className="eyebrow">Visual language</p>
          <h2>{data.revision.aesthetic || data.world.tone}</h2>
        </div>
        <div>
          <p className="eyebrow">Places that matter</p>
          <ul>
            {data.revision.locations.map((location) => (
              <li key={location}>
                <MapPin size={13} /> {location}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="world-detail-section cast-gallery">
        <div className="world-detail-heading">
          <span>01</span>
          <div>
            <p className="eyebrow">Cast</p>
            <h2>People carrying the tension</h2>
          </div>
        </div>
        <div className="public-cast-grid">
          {data.revision.characters.map((character, index) => (
            <article key={character.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{character.name}</h3>
              <strong>{character.role}</strong>
              <p>{character.personality}</p>
              {character.desire ? (
                <small>Wants: {character.desire}</small>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className="world-detail-section connections-public">
        <div className="world-detail-heading">
          <span>02</span>
          <div>
            <p className="eyebrow">Connections</p>
            <h2>Pressure moves between people</h2>
          </div>
        </div>
        <div className="public-relationship-list">
          {data.revision.relationships.map((relationship) => (
            <article key={relationship.id}>
              <strong>
                {characterNames.get(relationship.fromCharacterId)}
              </strong>
              <span>{relationship.kind.replaceAll("_", " ")}</span>
              <strong>{characterNames.get(relationship.toCharacterId)}</strong>
              <p>{relationship.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="world-detail-section world-truths-public">
        <div className="world-detail-heading">
          <span>03</span>
          <div>
            <p className="eyebrow">Rules, facts, tensions</p>
            <h2>What every branch inherits</h2>
          </div>
        </div>
        <ol>
          {data.revision.facts.map((fact) => (
            <li key={fact.id}>
              <span>{fact.category.replaceAll("_", " ")}</span>
              <p>{fact.statement}</p>
              <small>{fact.state}</small>
            </li>
          ))}
        </ol>
      </section>

      {data.revision.storySpark ? (
        <section className="story-spark-public">
          <Sparkles size={20} />
          <p className="eyebrow">The creator imagines</p>
          <blockquote>{data.revision.storySpark}</blockquote>
        </section>
      ) : null}

      <section className="world-remixes">
        <div className="discovery-section-heading">
          <div>
            <p className="eyebrow">Community remixes</p>
            <h2>Paths growing from this world</h2>
          </div>
          <span>
            <GitBranch size={15} /> {data.world.remixCount} published
          </span>
        </div>
        {data.branches.length ? (
          <div className="branch-card-row">
            {data.branches.map((branch) => (
              <div key={branch.id} className="branch-card-wrap">
                <BranchCard
                  branch={branch}
                  creator={data.branchCreators.get(branch.creatorId)}
                  creatorPick={data.world.creatorPickBranchId === branch.id}
                />
                {isCreator ? (
                  <CreatorPickButton
                    worldId={worldId}
                    branchId={branch.id}
                    selected={data.world.creatorPickBranchId === branch.id}
                  />
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="social-empty">
            No community branch has been published yet.
          </p>
        )}
      </section>
      <footer className="content-trust-row">
        <span>
          Published revision {data.world.currentRevisionId.slice(0, 8)}
        </span>
        <ReportAction targetType="world" targetId={worldId} />
      </footer>
    </main>
  );
}
