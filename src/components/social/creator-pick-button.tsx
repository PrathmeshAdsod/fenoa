"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { domainClient } from "@/lib/client/domain-client";

export function CreatorPickButton({
  worldId,
  branchId,
  selected,
}: {
  worldId: string;
  branchId: string;
  selected: boolean;
}) {
  const router = useRouter();
  const [active, setActive] = useState(selected);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setActive(selected), [selected]);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      await domainClient.setCreatorPick(worldId, active ? null : branchId);
      setActive(!active);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Creator Pick unavailable.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="creator-pick-control">
      <button
        className="text-action"
        disabled={busy}
        onClick={() => void toggle()}
      >
        <Sparkles size={13} />{" "}
        {active ? "Remove Creator Pick" : "Make Creator Pick"}
      </button>
      {error ? <small>{error}</small> : null}
    </div>
  );
}
