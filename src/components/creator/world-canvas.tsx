"use client";

import {
  ChevronDown,
  ImagePlus,
  Link2,
  MapPin,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { useState } from "react";

import type { UpdateWorldInput } from "@/lib/contracts/api";
import type { Character, Fact, Relationship } from "@/lib/contracts/domain";
import type { WorldDraft } from "@/lib/contracts/world";

type Props = {
  draft: WorldDraft;
  busy: boolean;
  onSave(input: UpdateWorldInput): Promise<boolean>;
  onGenerateImage(direction: string): Promise<void>;
};

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function emptyCharacter(): Character {
  return {
    id: newId("character"),
    name: "",
    role: "",
    appearance: "",
    personality: "",
    desire: "",
    fear: "",
    background: "",
    currentSituation: "",
    secret: "",
  };
}

export function WorldCanvas({ draft, busy, onSave, onGenerateImage }: Props) {
  const [canvas, setCanvas] = useState({
    name: draft.name,
    premise: draft.premise,
    genre: draft.genre,
    tone: draft.tone,
    aesthetic: draft.aesthetic,
    locations: draft.locations,
    characters: draft.characters,
    relationships: draft.relationships,
    facts: draft.facts,
    storySpark: draft.storySpark,
    remixEnabled: draft.remixEnabled,
  });
  const [imageDirection, setImageDirection] = useState("");
  // Track which character cards are expanded for editing
  const [expandedChars, setExpandedChars] = useState<Set<string>>(new Set());

  function toggleChar(id: string) {
    setExpandedChars((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function updateCharacter(index: number, patch: Partial<Character>) {
    setCanvas((current) => ({
      ...current,
      characters: current.characters.map((character, itemIndex) =>
        itemIndex === index ? { ...character, ...patch } : character,
      ),
    }));
  }

  function updateFact(index: number, patch: Partial<Fact>) {
    setCanvas((current) => ({
      ...current,
      facts: current.facts.map((fact, itemIndex) =>
        itemIndex === index ? { ...fact, ...patch } : fact,
      ),
    }));
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSave({ expectedVersion: draft.version, patch: canvas });
  }

  return (
    <form className="world-canvas" onSubmit={save}>
      <section id="world" className="canvas-section canvas-foundation">
        <div className="canvas-section-title">
          <span>01</span>
          <div>
            <p className="eyebrow">World</p>
            <h3>The idea everything grows from</h3>
          </div>
        </div>
        <div className="canvas-fields canvas-fields-primary">
          <label>
            Name
            <input
              value={canvas.name}
              minLength={2}
              maxLength={80}
              required
              onChange={(event) =>
                setCanvas({ ...canvas, name: event.target.value })
              }
            />
          </label>
          <label className="canvas-genre-field">
            Genre
            <input
              value={canvas.genre}
              minLength={2}
              maxLength={80}
              required
              onChange={(event) =>
                setCanvas({ ...canvas, genre: event.target.value })
              }
            />
          </label>
          <label className="wide">
            Premise
            <textarea
              value={canvas.premise}
              minLength={20}
              maxLength={600}
              required
              onChange={(event) =>
                setCanvas({ ...canvas, premise: event.target.value })
              }
            />
          </label>
        </div>

        <div className="world-artwork-row">
          <div
            className={`world-cover-workbench ${draft.coverImage ? "has-image" : ""}`}
            style={
              draft.coverImage
                ? { backgroundImage: `url("${draft.coverImage.url}")` }
                : undefined
            }
            role="img"
            aria-label={
              draft.coverImage?.alt ?? "World artwork has not been generated"
            }
          >
            <div className="world-cover-copy">
              <span>{canvas.genre}</span>
              <strong>{canvas.name || "Untitled world"}</strong>
            </div>
          </div>
          <div className="world-image-control">
            <div>
              <strong>Artwork</strong>
              <p>A visual reference for the published world.</p>
            </div>
            <input
              aria-label="Optional artwork direction"
              value={imageDirection}
              maxLength={500}
              placeholder="Optional art direction"
              onChange={(event) => setImageDirection(event.target.value)}
            />
            <button
              type="button"
              className="button button-quiet"
              disabled={busy}
              onClick={() => void onGenerateImage(imageDirection)}
            >
              <ImagePlus size={15} aria-hidden="true" />
              {draft.coverImage ? "Regenerate" : "Generate artwork"}
            </button>
          </div>
        </div>

        <details className="canvas-disclosure">
          <summary>More world details</summary>
          <div className="canvas-fields canvas-detail-fields">
            <label>
              Tone / atmosphere
              <input
                value={canvas.tone}
                minLength={2}
                maxLength={160}
                required
                onChange={(event) =>
                  setCanvas({ ...canvas, tone: event.target.value })
                }
              />
            </label>
            <label>
              Visual language
              <input
                value={canvas.aesthetic}
                maxLength={300}
                onChange={(event) =>
                  setCanvas({ ...canvas, aesthetic: event.target.value })
                }
              />
            </label>
            <label className="wide">
              <MapPin size={14} aria-hidden="true" /> Important locations, one
              per line
              <textarea
                value={canvas.locations.join("\n")}
                onChange={(event) =>
                  setCanvas({
                    ...canvas,
                    locations: event.target.value
                      .split("\n")
                      .map((item) => item.trim())
                      .filter(Boolean)
                      .slice(0, 6),
                  })
                }
              />
            </label>
          </div>
        </details>
      </section>

      <section id="characters" className="canvas-section">
        <div className="canvas-section-title">
          <span>02</span>
          <div>
            <p className="eyebrow">Cast</p>
            <h3>People under pressure</h3>
          </div>
          <button
            type="button"
            disabled={canvas.characters.length >= 8}
            onClick={() =>
              setCanvas({
                ...canvas,
                characters: [...canvas.characters, emptyCharacter()],
              })
            }
          >
            <Plus size={14} /> Add character
          </button>
        </div>
        <div className="canvas-cast">
          {canvas.characters.map((character, index) => {
            const isExpanded = expandedChars.has(character.id);
            const editorId = `character-${character.id}-editor`;
            return (
              <article
                key={character.id}
                className={isExpanded ? "char-editing" : ""}
              >
                <div className="artifact-item-heading">
                  <UserRound size={16} aria-hidden="true" />
                  <div className="character-summary">
                    <strong>
                      {character.name || `Character ${index + 1}`}
                    </strong>
                    <span>{character.role || "Role not set"}</span>
                    {character.personality ? (
                      <p>{character.personality}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="text-action character-edit-toggle"
                    aria-expanded={isExpanded}
                    aria-controls={editorId}
                    onClick={() => toggleChar(character.id)}
                  >
                    {isExpanded ? "Done" : "Edit"}
                    <ChevronDown size={13} aria-hidden="true" />
                  </button>
                </div>
                {isExpanded ? (
                  <div id={editorId} className="char-advanced">
                    <label>
                      Name
                      <input
                        value={character.name}
                        maxLength={80}
                        required
                        onChange={(event) =>
                          updateCharacter(index, { name: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      Role in the world
                      <input
                        value={character.role}
                        maxLength={120}
                        required
                        onChange={(event) =>
                          updateCharacter(index, { role: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      Appearance
                      <textarea
                        value={character.appearance}
                        maxLength={400}
                        onChange={(event) =>
                          updateCharacter(index, {
                            appearance: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Personality
                      <textarea
                        value={character.personality}
                        maxLength={400}
                        onChange={(event) =>
                          updateCharacter(index, {
                            personality: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Desire
                      <textarea
                        value={character.desire}
                        maxLength={300}
                        onChange={(event) =>
                          updateCharacter(index, { desire: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      Fear or flaw
                      <textarea
                        value={character.fear}
                        maxLength={300}
                        onChange={(event) =>
                          updateCharacter(index, { fear: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      Background
                      <textarea
                        value={character.background}
                        maxLength={600}
                        onChange={(event) =>
                          updateCharacter(index, {
                            background: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Current situation
                      <textarea
                        value={character.currentSituation}
                        maxLength={400}
                        onChange={(event) =>
                          updateCharacter(index, {
                            currentSituation: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="wide">
                      Secret
                      <textarea
                        value={character.secret}
                        maxLength={400}
                        onChange={(event) =>
                          updateCharacter(index, { secret: event.target.value })
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="text-action item-remove"
                      aria-label={`Remove ${character.name || `character ${index + 1}`}`}
                      onClick={() =>
                        setCanvas({
                          ...canvas,
                          characters: canvas.characters.filter(
                            (_, itemIndex) => itemIndex !== index,
                          ),
                          relationships: canvas.relationships.filter(
                            (relationship) =>
                              relationship.fromCharacterId !== character.id &&
                              relationship.toCharacterId !== character.id,
                          ),
                        })
                      }
                    >
                      <Trash2 size={13} aria-hidden="true" /> Remove character
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
          {!canvas.characters.length ? (
            <p className="canvas-empty">
              Add only the people who make the premise move.
            </p>
          ) : null}
        </div>
      </section>

      <section id="connections" className="canvas-section">
        <div className="canvas-section-title">
          <span>03</span>
          <div>
            <p className="eyebrow">Connections</p>
            <h3>What passes between them</h3>
          </div>
          <button
            type="button"
            disabled={
              canvas.characters.length < 2 || canvas.relationships.length >= 16
            }
            onClick={() => {
              const from = canvas.characters[0];
              const to = canvas.characters[1];
              if (!from || !to) return;
              setCanvas({
                ...canvas,
                relationships: [
                  ...canvas.relationships,
                  {
                    id: newId("relationship"),
                    fromCharacterId: from.id,
                    toCharacterId: to.id,
                    kind: "trust",
                    description: "",
                  },
                ],
              });
            }}
          >
            <Plus size={14} /> Add connection
          </button>
        </div>
        <div className="connection-list">
          {canvas.relationships.map((relationship, index) => {
            const fromName =
              canvas.characters.find(
                (character) => character.id === relationship.fromCharacterId,
              )?.name || "Unnamed";
            const toName =
              canvas.characters.find(
                (character) => character.id === relationship.toCharacterId,
              )?.name || "Unnamed";
            return (
              <details key={relationship.id} className="connection-item">
                <summary>
                  <Link2 size={15} aria-hidden="true" />
                  <strong>{fromName}</strong>
                  <span>{relationship.kind.replaceAll("_", " ")}</span>
                  <strong>{toName}</strong>
                  <small>{relationship.description}</small>
                </summary>
                <div className="connection-editor">
                  <label>
                    From character
                    <select
                      value={relationship.fromCharacterId}
                      onChange={(event) =>
                        setCanvas({
                          ...canvas,
                          relationships: canvas.relationships.map(
                            (item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    fromCharacterId: event.target.value,
                                  }
                                : item,
                          ),
                        })
                      }
                    >
                      {canvas.characters.map((character) => (
                        <option key={character.id} value={character.id}>
                          {character.name || "Unnamed"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Relationship
                    <select
                      value={relationship.kind}
                      onChange={(event) =>
                        setCanvas({
                          ...canvas,
                          relationships: canvas.relationships.map(
                            (item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    kind: event.target
                                      .value as Relationship["kind"],
                                  }
                                : item,
                          ),
                        })
                      }
                    >
                      {[
                        "trust",
                        "loyalty",
                        "rivalry",
                        "protection",
                        "fear",
                        "romance",
                        "family",
                        "deception",
                        "asymmetric_knowledge",
                      ].map((kind) => (
                        <option key={kind} value={kind}>
                          {kind.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    To character
                    <select
                      value={relationship.toCharacterId}
                      onChange={(event) =>
                        setCanvas({
                          ...canvas,
                          relationships: canvas.relationships.map(
                            (item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    toCharacterId: event.target.value,
                                  }
                                : item,
                          ),
                        })
                      }
                    >
                      {canvas.characters.map((character) => (
                        <option key={character.id} value={character.id}>
                          {character.name || "Unnamed"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="wide">
                    What connects them
                    <input
                      placeholder="John protects Emma but does not trust her."
                      value={relationship.description}
                      maxLength={300}
                      required
                      onChange={(event) =>
                        setCanvas({
                          ...canvas,
                          relationships: canvas.relationships.map(
                            (item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    description: event.target.value,
                                  }
                                : item,
                          ),
                        })
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="text-action item-remove"
                    onClick={() =>
                      setCanvas({
                        ...canvas,
                        relationships: canvas.relationships.filter(
                          (_, itemIndex) => itemIndex !== index,
                        ),
                      })
                    }
                  >
                    <Trash2 size={13} aria-hidden="true" /> Remove connection
                  </button>
                </div>
              </details>
            );
          })}
        </div>
      </section>

      <section id="truths" className="canvas-section">
        <div className="canvas-section-title">
          <span>04</span>
          <div>
            <p className="eyebrow">What stays true</p>
            <h3>Every remix must reckon with this</h3>
          </div>
          <button
            type="button"
            disabled={canvas.facts.length >= 16}
            onClick={() =>
              setCanvas({
                ...canvas,
                facts: [
                  ...canvas.facts,
                  {
                    id: newId("fact"),
                    category: "world_rule",
                    statement: "",
                    state: "true",
                  },
                ],
              })
            }
          >
            <Plus size={14} /> Add truth
          </button>
        </div>
        <div className="truth-list">
          {canvas.facts.map((fact, index) => (
            <details key={fact.id} className="truth-item">
              <summary>
                <ShieldCheck size={15} aria-hidden="true" />
                <span>{fact.category.replaceAll("_", " ")}</span>
                <strong>{fact.statement || "Untitled truth"}</strong>
                <small>{fact.state}</small>
              </summary>
              <div className="truth-editor">
                <label>
                  Category
                  <select
                    value={fact.category}
                    onChange={(event) =>
                      updateFact(index, {
                        category: event.target.value as Fact["category"],
                      })
                    }
                  >
                    {[
                      "world_rule",
                      "secret",
                      "character_knowledge",
                      "history",
                      "tension",
                    ].map((category) => (
                      <option key={category} value={category}>
                        {category.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="wide">
                  What stays true
                  <textarea
                    value={fact.statement}
                    maxLength={400}
                    required
                    onChange={(event) =>
                      updateFact(index, { statement: event.target.value })
                    }
                  />
                </label>
                <label>
                  State
                  <select
                    value={fact.state}
                    onChange={(event) =>
                      updateFact(index, {
                        state: event.target.value as Fact["state"],
                      })
                    }
                  >
                    <option value="true">True</option>
                    <option value="false">False</option>
                    <option value="unresolved">Unresolved</option>
                  </select>
                </label>
                <button
                  type="button"
                  className="text-action item-remove"
                  onClick={() =>
                    setCanvas({
                      ...canvas,
                      facts: canvas.facts.filter(
                        (_, itemIndex) => itemIndex !== index,
                      ),
                    })
                  }
                >
                  <Trash2 size={13} aria-hidden="true" /> Remove truth
                </button>
              </div>
            </details>
          ))}
        </div>
      </section>

      <section id="story-spark" className="canvas-section story-spark-section">
        <div className="canvas-section-title">
          <span>05</span>
          <div>
            <p className="eyebrow">Story spark</p>
            <h3>A door, left open</h3>
          </div>
        </div>
        <textarea
          value={canvas.storySpark}
          maxLength={1_200}
          placeholder="What kind of story might happen here? Keep it under 150 words."
          onChange={(event) =>
            setCanvas({ ...canvas, storySpark: event.target.value })
          }
        />
        <div className="story-spark-meta">
          <span>
            {canvas.storySpark.trim()
              ? canvas.storySpark.trim().split(/\s+/u).length
              : 0}{" "}
            / 150 words
          </span>
          <label>
            <input
              type="checkbox"
              checked={canvas.remixEnabled}
              onChange={(event) =>
                setCanvas({ ...canvas, remixEnabled: event.target.checked })
              }
            />
            Let the community remix this world
          </label>
        </div>
      </section>

      <div className="canvas-save-bar">
        <span>Canvas v{draft.version} · publish remains human-only</span>
        <button className="button button-primary" disabled={busy}>
          <Save size={15} /> Save canvas
        </button>
      </div>
    </form>
  );
}
