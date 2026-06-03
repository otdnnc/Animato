import type { UploadedModel } from "@/types/model";

import { useEffect, useState } from "react";
import { Button, Modal, Spinner, TextArea } from "@heroui/react";

import { buildPrompt, modelFromOutputUrl, runCode } from "@/lib/api";

interface ManualPromptModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  model: UploadedModel | null;
  /** The chat message describing the animation to embed in the prompt. */
  message: string;
  /** Called with the produced model after a successful run, to reload the viewer. */
  onModelReplaced: (model: UploadedModel) => void;
}

export function ManualPromptModal({
  isOpen,
  onOpenChange,
  model,
  message,
  onModelReplaced,
}: ManualPromptModalProps) {
  const [prompt, setPrompt] = useState("");
  const [promptLoading, setPromptLoading] = useState(false);
  const [code, setCode] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch the prompt from /api/prompt each time the dialog opens.
  useEffect(() => {
    if (!isOpen) return;

    setPrompt("");
    setCode("");
    setError(null);
    setOutput(null);
    setCopied(false);

    if (!model) {
      setError("Open a model before generating an animation.");

      return;
    }

    let cancelled = false;

    setPromptLoading(true);
    buildPrompt(model.filename, message)
      .then((res) => {
        if (!cancelled) setPrompt(res.prompt);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to build prompt.");
        }
      })
      .finally(() => {
        if (!cancelled) setPromptLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, model, message]);

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable (insecure context); ignore.
    }
  };

  const run = async (close: () => void) => {
    const trimmed = code.trim();

    if (!trimmed || running) return;

    setRunning(true);
    setError(null);
    setOutput(null);
    try {
      const res = await runCode(trimmed);

      if (res.ok) {
        // The script overwrites the model in place, so when the backend doesn't
        // report a produced file, reload the current model (cache-busted).
        const target = res.output_url ?? model?.url ?? null;

        if (target) onModelReplaced(modelFromOutputUrl(target));
        // Close so the (now reloading + auto-playing) viewer is visible.
        close();
      } else {
        setError(
          res.stderr.trim() || `Run failed (exit code ${res.returncode}).`,
        );
        if (res.stdout.trim()) setOutput(res.stdout.trim());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run code.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Backdrop>
        <Modal.Container scroll="inside" size="lg">
          <Modal.Dialog>
            {({ close }: { close: () => void }) => (
              <>
                <Modal.Header className="flex items-center justify-between gap-2">
                  <Modal.Heading className="text-base font-semibold">
                    Manual AI prompt
                  </Modal.Heading>
                  <Modal.CloseTrigger />
                </Modal.Header>

                <Modal.Body className="space-y-5">
                  {/* Step 1 — the generated prompt to copy into an AI agent. */}
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-foreground">
                        1. Copy this prompt into your AI coding agent
                      </p>
                      <Button
                        isDisabled={!prompt}
                        size="sm"
                        variant="secondary"
                        onPress={copyPrompt}
                      >
                        {copied ? "Copied!" : "Copy"}
                      </Button>
                    </div>
                    {promptLoading ? (
                      <div className="flex items-center gap-2 rounded-lg border border-separator bg-background px-3 py-6 text-sm text-muted">
                        <Spinner size="sm" /> Building prompt…
                      </div>
                    ) : (
                      <TextArea
                        readOnly
                        aria-label="Generated prompt"
                        className="h-40 w-full resize-y rounded-lg border border-separator bg-background p-3 font-mono text-[12px] leading-relaxed text-foreground outline-none"
                        value={prompt}
                      />
                    )}
                  </div>

                  {/* Step 2 — paste the code the AI returns. */}
                  <div>
                    <p className="mb-2 text-xs font-medium text-foreground">
                      2. Paste the code from your AI agent
                    </p>
                    <TextArea
                      aria-label="Generated code"
                      className="h-40 w-full resize-y rounded-lg border border-separator bg-background p-3 font-mono text-[12px] leading-relaxed text-foreground outline-none"
                      placeholder="import bpy
# …the bpy script returned by your AI agent…"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                    />
                  </div>

                  {output && (
                    <pre className="max-h-32 overflow-auto rounded-lg border border-separator bg-background p-3 text-[12px] leading-relaxed text-muted">
                      {output}
                    </pre>
                  )}

                  {error && (
                    <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded-lg border border-danger/40 bg-danger/10 p-3 text-[12px] leading-relaxed text-danger">
                      {error}
                    </pre>
                  )}
                </Modal.Body>

                <Modal.Footer className="flex justify-end gap-2">
                  <Button size="sm" variant="tertiary" onPress={close}>
                    Close
                  </Button>
                  <Button
                    isDisabled={!code.trim() || running}
                    size="sm"
                    variant="primary"
                    onPress={() => run(close)}
                  >
                    {running ? "Running…" : "Run"}
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
