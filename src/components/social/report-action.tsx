"use client";

import { Flag } from "lucide-react";
import { useState } from "react";

import { domainClient } from "@/lib/client/domain-client";
import { reportContentInputSchema } from "@/lib/contracts/api";

export function ReportAction({
  targetType,
  targetId,
}: {
  targetType: "world" | "branch";
  targetId: string;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await domainClient.reportContent(
        reportContentInputSchema.parse({
          targetType,
          targetId,
          reason: data.get("reason"),
          detail: data.get("detail"),
        }),
      );
      setStatus("Report received. Thank you.");
      setOpen(false);
    } catch (caught) {
      setStatus(
        caught instanceof Error ? caught.message : "Report unavailable.",
      );
    }
  }
  return (
    <div className="report-control">
      <button
        className="text-action"
        onClick={() => setOpen((value) => !value)}
      >
        <Flag size={13} /> Report
      </button>
      {open ? (
        <form onSubmit={submit}>
          <select name="reason" aria-label="Report reason" defaultValue="other">
            <option value="harassment">Harassment</option>
            <option value="hate">Hate</option>
            <option value="sexual">Sexual content</option>
            <option value="violence">Violence</option>
            <option value="spam">Spam</option>
            <option value="other">Other</option>
          </select>
          <input name="detail" maxLength={500} placeholder="Optional detail" />
          <button className="button button-quiet">Send report</button>
        </form>
      ) : null}
      {status ? <small>{status}</small> : null}
    </div>
  );
}
