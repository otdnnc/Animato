import type { UploadedModel } from "@/types/model";

import { useEffect, useState } from "react";
import { Button, Modal, Spinner } from "@heroui/react";

import { listFiles } from "@/lib/api";

interface OpenFileModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when the user picks an already-uploaded model from the list. */
  onPick: (model: UploadedModel) => void;
  /** Called when the user wants to upload a file from their local machine. */
  onChooseLocal: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extOf(filename: string): string {
  const dot = filename.lastIndexOf(".");

  return dot === -1 ? "" : filename.slice(dot + 1).toUpperCase();
}

export function OpenFileModal({
  isOpen,
  onOpenChange,
  onPick,
  onChooseLocal,
}: OpenFileModalProps) {
  const [files, setFiles] = useState<UploadedModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reload the file list from the backend each time the dialog opens.
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    setLoading(true);
    setError(null);
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
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Backdrop>
        <Modal.Container scroll="inside" size="lg">
          <Modal.Dialog>
            {({ close }: { close: () => void }) => (
              <>
                <Modal.Header className="flex items-center justify-between gap-2">
                  <Modal.Heading className="text-base font-semibold">
                    Open a model
                  </Modal.Heading>
                  <Modal.CloseTrigger />
                </Modal.Header>

                <Modal.Body className="space-y-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">
                    Uploaded models{files.length > 0 && ` (${files.length})`}
                  </p>

                  {loading ? (
                    <div className="flex items-center justify-center gap-3 py-10 text-muted">
                      <Spinner size="sm" />
                      <span className="text-sm">Loading uploaded models…</span>
                    </div>
                  ) : error ? (
                    <div className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                      {error}
                    </div>
                  ) : files.length === 0 ? (
                    <p className="py-10 text-center text-sm text-muted">
                      No models uploaded yet. Choose a file from your machine to
                      get started.
                    </p>
                  ) : (
                    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {files.map((model) => (
                        <li key={model.filename}>
                          <button
                            className="flex w-full items-center gap-3 rounded-xl border border-separator bg-surface px-4 py-3 text-left transition-colors hover:border-accent/60 hover:bg-accent/5"
                            onClick={() => {
                              onPick(model);
                              close();
                            }}
                          >
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
                </Modal.Body>

                <Modal.Footer className="flex justify-end gap-2">
                  <Button size="sm" variant="tertiary" onPress={close}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onPress={() => {
                      close();
                      onChooseLocal();
                    }}
                  >
                    Choose from local machine
                  </Button>
                </Modal.Footer>
              </>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
