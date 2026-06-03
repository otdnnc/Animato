import { useEffect, useState } from "react";
import { Button, Input, Modal } from "@heroui/react";

import {
  DEFAULT_ENDPOINT,
  GEMINI_MODELS,
  loadGeminiSettings,
  saveGeminiSettings,
} from "@/lib/settings";

export function GeminiSettingsModal() {
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [endpoint, setEndpoint] = useState(DEFAULT_ENDPOINT);
  const [model, setModel] = useState<string>(GEMINI_MODELS[0]);

  // Hydrate the form from storage each time the dialog opens.
  useEffect(() => {
    if (!open) return;

    const saved = loadGeminiSettings();

    setApiKey(saved?.apiKey ?? "");
    setEndpoint(saved?.endpoint ?? DEFAULT_ENDPOINT);
    setModel(saved?.model ?? GEMINI_MODELS[0]);
  }, [open]);

  const save = (close: () => void) => {
    saveGeminiSettings({ apiKey: apiKey.trim(), endpoint: endpoint.trim(), model });
    close();
  };

  return (
    <>
      <Button
        aria-label="Gemini AI settings"
        size="sm"
        variant="secondary"
        onPress={() => setOpen(true)}
      >
        <GearIcon />
        Settings
      </Button>

      <Modal isOpen={open} onOpenChange={setOpen}>
        <Modal.Backdrop>
          <Modal.Container scroll="inside" size="md">
            <Modal.Dialog>
              {({ close }: { close: () => void }) => (
                <>
                  <Modal.Header className="flex items-center justify-between gap-2">
                    <Modal.Heading className="text-base font-semibold">
                      Gemini AI settings
                    </Modal.Heading>
                    <Modal.CloseTrigger />
                  </Modal.Header>

                  <Modal.Body className="space-y-4">
                    <Field label="API key">
                      <Input
                        aria-label="API key"
                        className="w-full"
                        placeholder="AIza…"
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                      />
                    </Field>

                    <Field label="Endpoint">
                      <Input
                        aria-label="Endpoint"
                        className="w-full"
                        placeholder={DEFAULT_ENDPOINT}
                        type="url"
                        value={endpoint}
                        onChange={(e) => setEndpoint(e.target.value)}
                      />
                    </Field>

                    <Field label="Model">
                      <select
                        aria-label="Model"
                        className="w-full rounded-lg border border-separator bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                      >
                        {GEMINI_MODELS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </Modal.Body>

                  <Modal.Footer className="flex justify-end gap-2">
                    <Button size="sm" variant="tertiary" onPress={close}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      onPress={() => save(close)}
                    >
                      Save
                    </Button>
                  </Modal.Footer>
                </>
              )}
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

function GearIcon() {
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
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
