import type { UploadedModel } from "@/types/model";

import { useEffect, useRef, useState } from "react";
import { Button, Spinner, TextArea } from "@heroui/react";

import { GeminiSettingsModal } from "@/components/editor/gemini-settings-modal";
import { ManualPromptModal } from "@/components/editor/manual-prompt-modal";
import type { ChatTurn } from "@/lib/api";

import { chatGenerate, modelFromOutputUrl } from "@/lib/api";
import { hasGeminiSettings, loadGeminiSettings } from "@/lib/settings";

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  /** For a successful Gemini turn, the bpy code it produced (sent as history). */
  code?: string;
}

// Turn the visible conversation into the history we forward to Gemini: drop the
// welcome line and any transient status, and prefer an assistant turn's code so
// the model sees the script it wrote last time.
function toHistory(messages: ChatMessage[]): ChatTurn[] {
  return messages
    .filter((m) => m.id !== WELCOME.id && (m.role === "user" || !!m.code))
    .map((m) => ({
      role: m.role,
      content: m.role === "assistant" && m.code ? m.code : m.content,
    }));
}

const WELCOME: ChatMessage = {
  id: 0,
  role: "assistant",
  content:
    'Hi! Describe the animation you want — e.g. "make the walk cycle loop faster" or "add an idle breathing motion".',
};

interface ChatPanelProps {
  model: UploadedModel | null;
  /** Reload the viewer with a model produced by a run. */
  onModelReplaced: (model: UploadedModel) => void;
}

export function ChatPanel({ model, onModelReplaced }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualMessage, setManualMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, busy]);

  const addMessage = (
    role: ChatMessage["role"],
    content: string,
    code?: string,
  ) =>
    setMessages((prev) => [...prev, { id: prev.length, role, content, code }]);

  const clearChat = () => {
    if (busy) return;

    setMessages([WELCOME]);
    setDraft("");
  };

  // The automatic path: the backend builds the prompt from the chat message,
  // sends it (plus the prior conversation) to Gemini, and runs the bpy code it
  // returns — all via /api/chat — then we reload the viewer with the new model.
  const generateWithGemini = async (text: string, history: ChatTurn[]) => {
    const settings = loadGeminiSettings();

    if (!settings) return;

    if (!model) {
      addMessage("assistant", "Open a model before generating an animation.");

      return;
    }

    setBusy(true);
    try {
      const res = await chatGenerate(settings, model.filename, text, history);

      if (res.ok) {
        const target = res.output_url ?? model.url;

        onModelReplaced(modelFromOutputUrl(target));
        // Keep the produced code on the turn so it feeds the next request.
        addMessage(
          "assistant",
          "Done — the animation is loaded in the viewer.",
          res.code,
        );
      } else {
        const reason =
          res.stderr.trim() || `Run failed (exit code ${res.returncode}).`;

        addMessage("assistant", `The generated code failed to run:\n${reason}`);
      }
    } catch (err) {
      addMessage(
        "assistant",
        err instanceof Error ? err.message : "Failed to generate animation.",
      );
    } finally {
      setBusy(false);
    }
  };

  const send = () => {
    const text = draft.trim();

    if (!text || busy) return;

    // Snapshot the prior conversation before appending this turn — that's the
    // history Gemini gets; the new message is sent separately as the request.
    const history = toHistory(messages);

    addMessage("user", text);
    setDraft("");

    // With Gemini configured, generate directly. Without it, fall back to the
    // manual prompt → paste → run dialog.
    if (hasGeminiSettings()) {
      void generateWithGemini(text, history);

      return;
    }

    setManualMessage(text);
    setManualOpen(true);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-separator px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-accent" />
          <h2 className="text-sm font-semibold">AI Chat</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            aria-label="Clear chat"
            isDisabled={busy || messages.length <= 1}
            size="sm"
            variant="tertiary"
            onPress={clearChat}
          >
            Clear
          </Button>
          <GeminiSettingsModal />
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={
              message.role === "user" ? "flex justify-end" : "flex justify-start"
            }
          >
            <div
              className={
                "max-w-[85%] min-w-0 overflow-hidden whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm " +
                (message.role === "user"
                  ? "rounded-br-sm bg-accent text-white"
                  : "rounded-bl-sm bg-background text-foreground")
              }
            >
              {message.content}
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex justify-start">
            <div className="flex max-w-[85%] items-center gap-2 rounded-2xl rounded-bl-sm bg-background px-3 py-2 text-sm text-muted">
              <Spinner size="sm" />
              <span>Generating animation…</span>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-separator p-3">
        <div className="flex items-end gap-2">
          <TextArea
            aria-label="Message"
            className="max-h-32 min-h-10 flex-1 resize-none rounded-xl bg-background px-3 py-2 text-sm outline-none"
            disabled={busy}
            placeholder={busy ? "Generating…" : "Describe an animation change…"}
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <Button
            isIconOnly
            aria-label="Send message"
            isDisabled={busy || !draft.trim()}
            size="md"
            variant="primary"
            onPress={send}
          >
            <SendIcon />
          </Button>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted">
          Enter to send · Shift+Enter for newline
        </p>
      </div>

      <ManualPromptModal
        isOpen={manualOpen}
        message={manualMessage}
        model={model}
        onModelReplaced={onModelReplaced}
        onOpenChange={setManualOpen}
      />
    </div>
  );
}

function SendIcon() {
  return (
    <svg
      fill="none"
      height={18}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width={18}
    >
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}
