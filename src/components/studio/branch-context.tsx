"use client";

import {
  ChevronDown,
  LockKeyhole,
  Plus,
  Sparkles,
  UserRoundPlus,
  Waypoints,
  X,
} from "lucide-react";
import { useState } from "react";

import type {
  BranchDraft,
  Character,
  Fact,
  StoryConstraint,
} from "@/lib/contracts/domain";

function identifier(value: string, fallback: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72);
  return normalized || `${fallback}-${Date.now().toString(36)}`;
}

type BranchContextProps = {
  branch: BranchDraft;
  agentTargetIds: ReadonlySet<string>;
  busy: boolean;
  onAddCharacter(character: Character): Promise<boolean>;
  onUpsertRule(fact: Fact): Promise<boolean>;
  onRemoveRule(factId: string): Promise<void>;
  onSetConstraint(input: {
    action: "add" | "update";
    constraint: StoryConstraint;
  }): Promise<boolean>;
  onRemoveConstraint(constraintId: string): Promise<void>;
};

export function BranchContext(props: BranchContextProps) {
  const [open, setOpen] = useState(false);
  const [characterOpen, setCharacterOpen] = useState(false);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [lockOpen, setLockOpen] = useState(false);

  async function addCharacter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "");
    const saved = await props.onAddCharacter({
      id: identifier(name, "character"),
      name,
      role: String(data.get("role") ?? ""),
      appearance: "",
      personality: String(data.get("personality") ?? ""),
      desire: String(data.get("desire") ?? ""),
      fear: "",
      background: "",
      currentSituation: "",
      secret: String(data.get("secret") ?? ""),
    });
    if (!saved) return;
    form.reset();
    setCharacterOpen(false);
  }

  async function addRule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const statement = String(data.get("statement") ?? "");
    const saved = await props.onUpsertRule({
      id: identifier(statement, "rule"),
      category: String(data.get("category")) as Fact["category"],
      statement,
      state: String(data.get("state")) as Fact["state"],
    });
    if (!saved) return;
    form.reset();
    setRuleOpen(false);
  }

  async function addLock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const factId = String(data.get("factId") ?? "");
    const fact = props.branch.ruleOverrides.find((item) => item.id === factId);
    if (!fact) return;
    const saved = await props.onSetConstraint({
      action: "add",
      constraint: {
        id: `${fact.id.slice(0, 115)}-wording-lock`,
        type: "branch_fact_lock",
        label: `Keep: ${fact.statement}`.slice(0, 160),
        description: "Preserve this branch truth while the sequence develops.",
        factId: fact.id,
        statement: fact.statement,
      },
    });
    if (!saved) return;
    setLockOpen(false);
  }

  const originalCount =
    props.branch.inheritedCharacters.length +
    props.branch.inheritedFacts.length;
  const changeCount =
    props.branch.addedCharacters.length + props.branch.ruleOverrides.length;
  const lockCount =
    props.branch.inheritedConstraints.length + props.branch.constraints.length;

  return (
    <section className="context-panel" aria-labelledby="branch-context-title">
      <button
        type="button"
        className={`context-panel-toggle ${open ? "open" : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="context-panel-toggle-label">
          <p className="eyebrow">Reference</p>
          <strong id="branch-context-title">Story Context</strong>
          <span className="context-summary">
            <span>Original {originalCount}</span>
            <span>Changes {changeCount}</span>
            <span>Locks {lockCount}</span>
          </span>
        </div>
        <ChevronDown size={16} aria-hidden="true" />
      </button>

      {open && (
        <div className="context-panel-body">
          <div className="context-band inherited">
            <Waypoints size={17} aria-hidden="true" />
            <div>
              <strong>From original world</strong>
              <p>{props.branch.inheritedSummary}</p>
              <small>
                Base: {props.branch.baseWorldRevisionId}
                {props.branch.parentBranchRevisionId
                  ? ` · branch ${props.branch.parentBranchRevisionId}`
                  : ""}
              </small>
              {props.branch.inheritedCharacters.length ||
              props.branch.inheritedFacts.length ||
              props.branch.inheritedConstraints.length ? (
                <div className="inherited-counts">
                  <span>{props.branch.inheritedCharacters.length} cast</span>
                  <span>{props.branch.inheritedFacts.length} truths</span>
                  <span>
                    {props.branch.inheritedConstraints.length} story locks
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="context-section changed">
            <div className="context-section-heading">
              <div>
                <Sparkles size={16} aria-hidden="true" />
                <strong>Changed in this remix</strong>
              </div>
              <div className="context-add-actions">
                <button
                  type="button"
                  onClick={() => setCharacterOpen((v) => !v)}
                >
                  <UserRoundPlus size={14} aria-hidden="true" /> Character
                </button>
                <button type="button" onClick={() => setRuleOpen((v) => !v)}>
                  <Plus size={14} aria-hidden="true" /> Rule
                </button>
              </div>
            </div>

            {characterOpen ? (
              <form className="context-form" onSubmit={addCharacter}>
                <label>
                  Name
                  <input name="name" maxLength={80} required />
                </label>
                <label>
                  Role in this branch
                  <input name="role" maxLength={120} required />
                </label>
                <label>
                  Desire
                  <input name="desire" maxLength={300} />
                </label>
                <label>
                  Personality
                  <input name="personality" maxLength={400} />
                </label>
                <label className="context-form-wide">
                  Secret
                  <textarea name="secret" maxLength={400} />
                </label>
                <button className="button button-primary" disabled={props.busy}>
                  Add only to this branch
                </button>
              </form>
            ) : null}

            {ruleOpen ? (
              <form className="context-form" onSubmit={addRule}>
                <label className="context-form-wide">
                  Branch truth or rule
                  <textarea name="statement" maxLength={400} required />
                </label>
                <label>
                  Category
                  <select name="category" defaultValue="world_rule">
                    <option value="world_rule">World rule</option>
                    <option value="secret">Secret</option>
                    <option value="character_knowledge">
                      Character knowledge
                    </option>
                    <option value="history">History</option>
                    <option value="tension">Tension</option>
                  </select>
                </label>
                <label>
                  State
                  <select name="state" defaultValue="true">
                    <option value="true">True here</option>
                    <option value="false">False here</option>
                    <option value="unresolved">Unresolved</option>
                  </select>
                </label>
                <button className="button button-primary" disabled={props.busy}>
                  Add branch change
                </button>
              </form>
            ) : null}

            {props.branch.addedCharacters.length ||
            props.branch.ruleOverrides.length ? (
              <div className="change-list">
                {props.branch.addedCharacters.map((character) => (
                  <article
                    key={character.id}
                    className={
                      props.agentTargetIds.has(character.id)
                        ? "agent-applied"
                        : ""
                    }
                  >
                    <span>Added character</span>
                    <strong>{character.name}</strong>
                    <p>{character.role}</p>
                  </article>
                ))}
                {props.branch.ruleOverrides.map((fact) => (
                  <article
                    key={fact.id}
                    className={
                      props.agentTargetIds.has(fact.id) ? "agent-applied" : ""
                    }
                  >
                    <span>{fact.category.replaceAll("_", " ")}</span>
                    <strong>{fact.statement}</strong>
                    <div className="change-meta">
                      <small>{fact.state}</small>
                      <button
                        type="button"
                        aria-label={`Remove ${fact.statement}`}
                        disabled={props.busy}
                        onClick={() => void props.onRemoveRule(fact.id)}
                      >
                        <X size={13} aria-hidden="true" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="context-empty">
                This branch still follows the inherited cast and rules exactly.
              </p>
            )}
          </div>

          <div className="context-section locked">
            <div className="context-section-heading">
              <div>
                <LockKeyhole size={16} aria-hidden="true" />
                <strong>Must stay true</strong>
              </div>
              <button
                type="button"
                disabled={!props.branch.ruleOverrides.length}
                onClick={() => setLockOpen((value) => !value)}
              >
                <Plus size={14} aria-hidden="true" /> Lock a rule
              </button>
            </div>
            {lockOpen ? (
              <form className="context-form single-row" onSubmit={addLock}>
                <label>
                  Branch rule to lock
                  <select name="factId" required>
                    {props.branch.ruleOverrides.map((fact) => (
                      <option key={fact.id} value={fact.id}>
                        {fact.statement}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="button button-primary" disabled={props.busy}>
                  Lock wording
                </button>
              </form>
            ) : null}
            <ul className="lock-list">
              {props.branch.inheritedConstraints.map((constraint) => (
                <li
                  key={`inherited-${constraint.id}`}
                  className="inherited-lock"
                >
                  <div>
                    <span>Carried from source</span>
                    <strong>{constraint.label}</strong>
                    <p>{constraint.description}</p>
                  </div>
                </li>
              ))}
              {props.branch.constraints.map((constraint) => (
                <li
                  key={constraint.id}
                  className={
                    props.agentTargetIds.has(constraint.id)
                      ? "agent-applied"
                      : ""
                  }
                >
                  <div>
                    <strong>{constraint.label}</strong>
                    <p>{constraint.description}</p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${constraint.label}`}
                    disabled={props.busy}
                    onClick={() => void props.onRemoveConstraint(constraint.id)}
                  >
                    <X size={13} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
