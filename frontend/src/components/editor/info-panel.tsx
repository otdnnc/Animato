import type { ModelInfo, SceneNode } from "@/types/model";

import { useState } from "react";
import { Chip, Spinner } from "@heroui/react";

interface InfoPanelProps {
  info: ModelInfo | null;
  loading: boolean;
  activeIndex: number | null;
  isPlaying: boolean;
  onSelect: (index: number) => void;
  onTogglePlay: () => void;
  /** Delete an animation clip by name (omit to hide the delete buttons). */
  onRemove?: (name: string) => void;
  /** Name of the clip currently being deleted, to show progress / disable. */
  removingName?: string | null;
}

export function InfoPanel({
  info,
  loading,
  activeIndex,
  isPlaying,
  onSelect,
  onTogglePlay,
  onRemove,
  removingName = null,
}: InfoPanelProps) {
  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex items-center gap-2 border-b border-separator px-4 py-3">
        <CubeIcon />
        <h2 className="text-sm font-semibold">Scene Info</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted">
            <Spinner />
            <span className="text-sm">Loading model…</span>
          </div>
        )}

        {!loading && !info && (
          <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted">
            No model loaded.
          </div>
        )}

        {!loading && info && (
          <div className="space-y-6 p-4">
            <Section title="Overview">
              <div className="space-y-2">
                <Row label="File" value={info.fileName} />
                <Row label="Format" value={info.format} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Stat label="Meshes" value={info.stats.meshes} />
                <Stat label="Bones" value={info.stats.bones} />
                <Stat
                  label="Vertices"
                  value={info.stats.vertices.toLocaleString()}
                />
                <Stat label="Materials" value={info.stats.materials} />
              </div>
            </Section>

            <Section title={`Animations (${info.animations.length})`}>
              {info.animations.length === 0 ? (
                <p className="text-sm text-muted">No animation clips.</p>
              ) : (
                <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                  {info.animations.map((clip, index) => {
                    const active = index === activeIndex;
                    const noMotion =
                      clip.trackCount === 0 || clip.duration < 0.05;

                    const removing = removingName === clip.name;

                    return (
                      <li key={index} className="flex items-stretch gap-1">
                        <button
                          className={
                            "flex flex-1 items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors " +
                            (active
                              ? "border-accent bg-accent/10"
                              : "border-separator bg-background hover:border-accent/50")
                          }
                          onClick={() =>
                            active ? onTogglePlay() : onSelect(index)
                          }
                        >
                          <span
                            className={
                              "flex size-6 shrink-0 items-center justify-center rounded-full " +
                              (active
                                ? "bg-accent text-white"
                                : "bg-surface text-muted")
                            }
                          >
                            {active && isPlaying ? <PauseIcon /> : <PlayIcon />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                              {clip.name || "(unnamed clip)"}
                            </span>
                            <span className="block text-[11px] text-muted">
                              {clip.duration.toFixed(2)}s · {clip.trackCount}{" "}
                              tracks
                              {noMotion && (
                                <span className="text-warning">
                                  {" "}
                                  · no motion
                                </span>
                              )}
                            </span>
                          </span>
                        </button>
                        {onRemove && (
                          <button
                            aria-label={`Delete ${clip.name || "clip"}`}
                            className="flex w-8 shrink-0 items-center justify-center rounded-lg border border-separator bg-background text-muted transition-colors hover:border-danger/50 hover:text-danger disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-separator disabled:hover:text-muted"
                            disabled={removingName !== null || !clip.name}
                            title="Delete animation"
                            onClick={() => onRemove(clip.name)}
                          >
                            {removing ? <Spinner size="sm" /> : <TrashIcon />}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {activeIndex !== null && info.animations[activeIndex] && (
                <div className="sticky bottom-0 z-10 mt-2 flex items-center gap-2.5 rounded-lg border border-accent/40 bg-surface/95 p-2 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
                  <button
                    aria-label={isPlaying ? "Pause" : "Play"}
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-colors hover:bg-accent/90"
                    onClick={onTogglePlay}
                  >
                    {isPlaying ? <PauseIcon /> : <PlayIcon />}
                  </button>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-medium uppercase tracking-wide text-muted">
                      {isPlaying ? "Now playing" : "Paused"}
                    </span>
                    <span className="block truncate text-sm font-medium">
                      {info.animations[activeIndex].name || "(unnamed clip)"}
                    </span>
                  </span>
                </div>
              )}
            </Section>

            <Section title={`Skeleton (${info.stats.bones} bones)`}>
              {info.bones.length === 0 ? (
                <p className="text-sm text-muted">No skeleton in this model.</p>
              ) : (
                <div className="rounded-lg border border-separator bg-background p-2">
                  {info.bones.map((bone, i) => (
                    <TreeNode key={i} depth={0} node={bone} />
                  ))}
                </div>
              )}
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}

function TreeNode({ node, depth }: { node: SceneNode; depth: number }) {
  const [open, setOpen] = useState(false);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-1 rounded py-0.5 text-sm hover:bg-surface"
        style={{ paddingLeft: depth * 12 }}
      >
        {hasChildren ? (
          <button
            aria-label={open ? "Collapse" : "Expand"}
            className="flex size-4 shrink-0 items-center justify-center text-muted"
            onClick={() => setOpen((v) => !v)}
          >
            <Caret open={open} />
          </button>
        ) : (
          <span className="size-4 shrink-0" />
        )}
        <BoneIcon />
        <span className="truncate">{node.name}</span>
      </div>
      {open &&
        hasChildren &&
        node.children.map((child, i) => (
          <TreeNode key={i} depth={depth + 1} node={child} />
        ))}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted">{label}</span>
      <span className="min-w-0 truncate font-medium" title={value}>
        {value}
      </span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Chip size="sm" variant="secondary">
      {label}: {value}
    </Chip>
  );
}

function Caret({ open }: { open: boolean }) {
  return (
    <svg
      className={
        open ? "rotate-90 transition-transform" : "transition-transform"
      }
      fill="none"
      height={12}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width={12}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function BoneIcon() {
  return (
    <svg
      className="shrink-0 text-accent"
      fill="none"
      height={14}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width={14}
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 9V3M12 21v-6M9 12H3M21 12h-6" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg fill="currentColor" height={11} viewBox="0 0 24 24" width={11}>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      fill="none"
      height={14}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width={14}
    >
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg fill="currentColor" height={11} viewBox="0 0 24 24" width={11}>
      <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
    </svg>
  );
}

function CubeIcon() {
  return (
    <svg
      className="text-accent"
      fill="none"
      height={16}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width={16}
    >
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="m3.27 6.96 8.73 5.05 8.73-5.05M12 22.08V12" />
    </svg>
  );
}
