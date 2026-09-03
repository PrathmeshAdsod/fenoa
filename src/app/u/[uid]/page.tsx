import { GitBranch, Heart } from "lucide-react";
import { notFound } from "next/navigation";

import { BranchCard } from "@/components/social/branch-card";
import { ProfileEditor } from "@/components/social/profile-editor";
import { WorldCard } from "@/components/social/world-card";
import { DomainError } from "@/lib/domain/errors";
import { optionalUser } from "@/lib/server/auth";
import { getPublicProfile } from "@/lib/server/world-repository";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  const { uid } = await params;
  let data: Awaited<ReturnType<typeof getPublicProfile>>;
  try {
    data = await getPublicProfile(uid);
  } catch (error) {
    if (error instanceof DomainError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
  const current = await optionalUser();
  return (
    <main className="profile-page">
      <header className="profile-hero">
        <div
          className="profile-avatar"
          style={
            data.profile.avatarUrl
              ? { backgroundImage: `url("${data.profile.avatarUrl}")` }
              : undefined
          }
        >
          {data.profile.avatarUrl ? null : data.profile.displayName.slice(0, 1)}
        </div>
        <div>
          <p className="eyebrow">Fenoa creator</p>
          <h1>{data.profile.displayName}</h1>
          <p>
            {data.profile.bio ||
              "Creating possibility spaces and the branches that grow from them."}
          </p>
        </div>
        <div className="profile-totals">
          <span>
            <strong>{data.totals.worlds}</strong> worlds
          </span>
          <span>
            <GitBranch size={14} />
            <strong>{data.totals.branches}</strong> remixes
          </span>
          <span>
            <Heart size={14} />
            <strong>{data.totals.likesReceived}</strong> likes received
          </span>
        </div>
      </header>
      {current?.uid === uid ? <ProfileEditor profile={data.profile} /> : null}
      <section className="profile-section">
        <p className="eyebrow">Original worlds</p>
        <h2>Possibilities created</h2>
        <div className="world-card-row">
          {data.worlds.map((world) => (
            <WorldCard key={world.id} world={world} creator={data.profile} />
          ))}
        </div>
        {!data.worlds.length ? (
          <p className="social-empty">No published worlds yet.</p>
        ) : null}
      </section>
      <section className="profile-section">
        <p className="eyebrow">Remixes</p>
        <h2>Possibilities explored</h2>
        <div className="branch-card-row">
          {data.branches.map((branch) => (
            <BranchCard
              key={branch.id}
              branch={branch}
              creator={data.profile}
            />
          ))}
        </div>
        {!data.branches.length ? (
          <p className="social-empty">No published remixes yet.</p>
        ) : null}
      </section>
    </main>
  );
}
