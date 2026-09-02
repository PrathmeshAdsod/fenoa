"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import type { Episode } from "@/lib/contracts/domain";

type EpisodeBoardProps = {
  episodes: Episode[];
  selectedId: string | null;
  agentTargetIds: ReadonlySet<string>;
  busy: boolean;
  onSelect(id: string): void;
  onMove(id: string, position: number): Promise<void>;
  onAdd(input: { title: string; hook: string }): Promise<void>;
  onDelete(id: string): Promise<void>;
};

function SortableEpisode({
  episode,
  index,
  count,
  selected,
  agentChanged,
  busy,
  onSelect,
  onMove,
  onDelete,
}: {
  episode: Episode;
  index: number;
  count: number;
  selected: boolean;
  agentChanged: boolean;
  busy: boolean;
  onSelect(): void;
  onMove(position: number): void;
  onDelete(): void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: episode.id, disabled: busy });
  return (
    <article
      ref={setNodeRef}
      className={`episode-card ${selected ? "selected" : ""} ${agentChanged ? "agent-changed" : ""} ${isDragging ? "dragging" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        className="drag-handle"
        type="button"
        aria-label={`Drag ${episode.title}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={17} aria-hidden="true" />
      </button>
      <button className="episode-select" type="button" onClick={onSelect}>
        <span className="episode-number">
          {String(episode.position).padStart(2, "0")}
        </span>
        <span className="episode-copy">
          <strong>{episode.title}</strong>
          <small>{episode.hook}</small>
        </span>
        {agentChanged ? (
          <span className="agent-mark">
            <Sparkles size={12} aria-hidden="true" /> Agent changed
          </span>
        ) : null}
      </button>
      <div className="episode-controls" aria-label={`Move ${episode.title}`}>
        <button
          type="button"
          aria-label="Move episode up"
          disabled={busy || index === 0}
          onClick={() => onMove(index)}
        >
          <ChevronUp size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Move episode down"
          disabled={busy || index === count - 1}
          onClick={() => onMove(index + 2)}
        >
          <ChevronDown size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={`Delete ${episode.title}`}
          disabled={busy || count <= 1}
          onClick={onDelete}
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

export function EpisodeBoard(props: EpisodeBoardProps) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [hook, setHook] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return;
    const targetIndex = props.episodes.findIndex(
      (episode) => episode.id === event.over?.id,
    );
    if (targetIndex >= 0) {
      await props.onMove(String(event.active.id), targetIndex + 1);
    }
  }

  async function submitEpisode(event: React.FormEvent) {
    event.preventDefault();
    await props.onAdd({ title, hook });
    setTitle("");
    setHook("");
    setAdding(false);
  }

  return (
    <section className="branch-board" aria-labelledby="branch-board-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">The living artifact</p>
          <h2 id="branch-board-title">Branch Board</h2>
        </div>
        <div className="board-actions">
          <span>{props.episodes.length} episodes</span>
          <button
            className="text-action"
            type="button"
            disabled={props.busy || props.episodes.length >= 8}
            onClick={() => setAdding((value) => !value)}
          >
            <Plus size={14} aria-hidden="true" /> Add episode
          </button>
        </div>
      </div>

      {adding ? (
        <form className="inline-create" onSubmit={submitEpisode}>
          <label>
            Episode title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={80}
              required
            />
          </label>
          <label>
            Hook
            <input
              value={hook}
              onChange={(event) => setHook(event.target.value)}
              maxLength={300}
              required
            />
          </label>
          <div className="inline-actions">
            <button className="button button-primary" disabled={props.busy}>
              Add to sequence
            </button>
            <button
              className="button button-quiet"
              type="button"
              onClick={() => setAdding(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={props.episodes.map((episode) => episode.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="episode-sequence">
            {props.episodes.map((episode, index) => (
              <SortableEpisode
                key={episode.id}
                episode={episode}
                index={index}
                count={props.episodes.length}
                selected={props.selectedId === episode.id}
                agentChanged={props.agentTargetIds.has(episode.id)}
                busy={props.busy}
                onSelect={() => props.onSelect(episode.id)}
                onMove={(position) => void props.onMove(episode.id, position)}
                onDelete={() => setPendingDelete(episode.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {pendingDelete ? (
        <div className="delete-confirm" role="alertdialog" aria-modal="true">
          <p>Remove this episode and close the gap in the sequence?</p>
          <div className="inline-actions">
            <button
              className="button button-danger"
              disabled={props.busy}
              onClick={() => {
                void props
                  .onDelete(pendingDelete)
                  .then(() => setPendingDelete(null));
              }}
            >
              Remove episode
            </button>
            <button
              className="button button-quiet"
              type="button"
              onClick={() => setPendingDelete(null)}
            >
              Keep it
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
