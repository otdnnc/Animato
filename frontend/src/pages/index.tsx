import type { UploadedModel } from "@/types/model";

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Chip, Spinner } from "@heroui/react";

import { title, subtitle } from "@/components/primitives";
import { listFiles, uploadModel } from "@/lib/api";
import { setModel } from "@/lib/model-store";
import { ACCEPT_ATTR, ACCEPTED_MODEL_EXTENSIONS } from "@/types/model";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extOf(filename: string): string {
  const dot = filename.lastIndexOf(".");

  return dot === -1 ? "" : filename.slice(dot + 1).toUpperCase();
}

export default function IndexPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<UploadedModel[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the list of already-uploaded models on mount.
  useEffect(() => {
    let cancelled = false;

    listFiles()
      .then((list) => {
        if (!cancelled) setFiles(list);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load files.");
        }
      })
      .finally(() => {
        if (!cancelled) setListLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const open = (model: UploadedModel) => {
    setModel(model);
    navigate("/editor");
  };

  const openFileBrowser = () => inputRef.current?.click();

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    event.target.value = "";
    if (!file) return;

    setError(null);
    setUploading(true);
    try {
      open(await uploadModel(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      setUploading(false);
    }
  };

  return (
    <section className="mx-auto flex min-h-screen max-w-5xl flex-col items-center gap-8 px-6 py-16">
      <div className="inline-block max-w-2xl justify-center text-center">
        <span className={title()}>Animate any&nbsp;</span>
        <span className={title({ color: "violet" })}>3D model&nbsp;</span>
        <br />
        <span className={title()}>with a single prompt.</span>
        <div className={subtitle({ class: "mt-4" })}>
          Open a 3D file to inspect its meshes, skeleton, and animation clips —
          then edit them with AI in a live Three.js editor.
        </div>
      </div>

      <input
        ref={inputRef}
        accept={ACCEPT_ATTR}
        className="hidden"
        type="file"
        onChange={handleFile}
      />

      <Button
        isDisabled={uploading}
        size="lg"
        variant="primary"
        onPress={openFileBrowser}
      >
        {uploading ? <Spinner size="sm" /> : <CubeIcon />}
        {uploading ? "Uploading…" : "Open 3D file"}
      </Button>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="text-sm text-muted">Supported formats:</span>
        {ACCEPTED_MODEL_EXTENSIONS.map((ext) => (
          <Chip key={ext} size="sm" variant="secondary">
            {ext}
          </Chip>
        ))}
      </div>

      {error && (
        <div className="max-w-md rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-center text-sm text-danger">
          {error}
        </div>
      )}

      {/* Previously uploaded models. */}
      <div className="w-full">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Uploaded models{files.length > 0 && ` (${files.length})`}
        </h2>

        {listLoading ? (
          <div className="flex items-center justify-center gap-3 py-10 text-muted">
            <Spinner size="sm" />
            <span className="text-sm">Loading uploaded models…</span>
          </div>
        ) : files.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">
            No models uploaded yet. Open a 3D file to get started.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {files.map((model) => (
              <li key={model.filename}>
                <button
                  className="flex w-full items-center gap-3 rounded-xl border border-separator bg-surface px-4 py-3 text-left transition-colors hover:border-accent/60 hover:bg-accent/5"
                  onClick={() => open(model)}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <CubeIcon />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className="block truncate text-sm font-medium text-foreground"
                      title={model.filename}
                    >
                      {model.filename}
                    </span>
                    <span className="block text-[11px] text-muted">
                      {extOf(model.filename)} · {formatSize(model.size)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function CubeIcon() {
  return (
    <svg
      fill="none"
      height={20}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width={20}
    >
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="m3.27 6.96 8.73 5.05 8.73-5.05M12 22.08V12" />
    </svg>
  );
}
