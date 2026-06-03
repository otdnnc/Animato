import type { ModelInfo } from "@/types/model";

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Spinner } from "@heroui/react";

import ThreeViewer from "@/components/editor/three-viewer";
import { ChatPanel } from "@/components/editor/chat-panel";
import { InfoPanel } from "@/components/editor/info-panel";
import { OpenFileModal } from "@/components/editor/open-file-modal";
import { modelFromOutputUrl, removeAnimation, uploadModel } from "@/lib/api";
import { setModel, useModel } from "@/lib/model-store";
import { ACCEPT_ATTR } from "@/types/model";

export default function EditorPage() {
  const model = useModel();
  const inputRef = useRef<HTMLInputElement>(null);

  const [info, setInfo] = useState<ModelInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [removingAnim, setRemovingAnim] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Reset derived state whenever a new model is opened.
  useEffect(() => {
    setInfo(null);
    setError(null);
    setActiveIndex(null);
    setIsPlaying(true);
  }, [model]);

  const openFileBrowser = () => inputRef.current?.click();

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0];

    event.target.value = "";
    if (!picked) return;

    setError(null);
    setUploading(true);
    try {
      setModel(await uploadModel(picked));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  // Download the current model file. The backend is a different origin, so the
  // anchor `download` attribute alone won't rename or even trigger a save —
  // fetch the bytes into a blob and download that with the stored filename.
  const handleExport = async () => {
    if (!model || exporting) return;

    setError(null);
    setExporting(true);
    try {
      const res = await fetch(model.absolute_url);

      if (!res.ok) throw new Error(`Download failed (${res.status}).`);

      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = href;
      link.download = model.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  const handleLoaded = (loaded: ModelInfo) => {
    setInfo(loaded);
    setError(null);
    // No auto-select: a clip plays only when the user clicks it in the panel.
    setActiveIndex(null);
    setIsPlaying(true);
  };

  // Delete an animation clip from the model, then reload the viewer with the
  // overwritten file (cache-busted) so the clip list reflects the removal.
  const handleRemoveAnimation = async (name: string) => {
    if (!model || removingAnim) return;
    if (
      !window.confirm(
        `Delete animation "${name}" from ${model.filename}? This overwrites the file.`,
      )
    )
      return;

    setError(null);
    setRemovingAnim(name);
    try {
      const res = await removeAnimation(model.filename, name);

      setModel(modelFromOutputUrl(res.output_url ?? model.url));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove animation.");
    } finally {
      setRemovingAnim(null);
    }
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
      <input
        ref={inputRef}
        accept={ACCEPT_ATTR}
        className="hidden"
        type="file"
        onChange={handleFile}
      />

      <header className="flex h-12 shrink-0 items-center justify-between border-b border-separator px-4">
        <div className="flex items-center gap-3">
          <Link
            className="text-sm font-bold text-foreground hover:text-accent"
            to="/"
          >
            Animation AI Maker
          </Link>
          {model && (
            <span className="truncate text-xs text-muted" title={model.filename}>
              {model.filename}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            isDisabled={!model || exporting}
            size="sm"
            variant="tertiary"
            onPress={handleExport}
          >
            {exporting ? "Exporting…" : "Export model"}
          </Button>
          <Button
            isDisabled={uploading}
            size="sm"
            variant="tertiary"
            onPress={() => setPickerOpen(true)}
          >
            {uploading ? "Uploading…" : "Open new file"}
          </Button>
        </div>
      </header>

      <OpenFileModal
        isOpen={pickerOpen}
        onChooseLocal={openFileBrowser}
        onOpenChange={setPickerOpen}
        onPick={setModel}
      />

      <div className="flex min-h-0 flex-1">
        {/* Left: chat panel (20%) */}
        <aside className="w-1/5 min-w-[220px] shrink-0 border-r border-separator">
          <ChatPanel model={model} onModelReplaced={setModel} />
        </aside>

        {/* Center: 3D viewer */}
        <div className="relative min-w-0 flex-1">
          {model ? (
            <ThreeViewer
              activeClipIndex={activeIndex}
              isPlaying={isPlaying}
              model={model}
              onError={setError}
              onLoaded={handleLoaded}
              onLoadingChange={setLoading}
            />
          ) : (
            <EmptyViewer onOpen={openFileBrowser} />
          )}

          {model && loading && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/40">
              <Spinner />
            </div>
          )}

          {error && (
            <div className="absolute inset-x-0 top-0 m-4 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}
        </div>

        {/* Right: info panel (20%) */}
        <aside className="w-1/5 min-w-[240px] shrink-0 border-l border-separator">
          <InfoPanel
            activeIndex={activeIndex}
            info={info}
            isPlaying={isPlaying}
            loading={loading}
            removingName={removingAnim}
            onRemove={handleRemoveAnimation}
            onSelect={(index) => {
              setActiveIndex(index);
              setIsPlaying(true);
            }}
            onTogglePlay={() => setIsPlaying((v) => !v)}
          />
        </aside>
      </div>
    </div>
  );
}

function EmptyViewer({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <p className="max-w-sm text-muted">
        No model loaded. Open a 3D file (.gltf, .fbx, .obj) to view it here.
      </p>
      <Button variant="primary" onPress={onOpen}>
        Open 3D file
      </Button>
    </div>
  );
}
