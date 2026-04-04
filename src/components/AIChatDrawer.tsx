"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useSession } from "next-auth/react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import {
  Bot,
  Brain,
  Send,
  Sparkles,
  User,
  X,
  Zap,
  TrendingUp,
  Target,
  BarChart3,
  Mic,
  Square,
  ArrowUp,
  ExternalLink,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import ToolCallAccordion from "@/components/ToolCallAccordion";
import type { ToolCallData } from "@/components/ToolCallAccordion";
import ChatMarkdown from "@/components/ChatMarkdown";
import { Button } from "@/components/ui/button";

// ── Types ────────────────────────────────────────────────────

export type ChatMode =
  | { type: "coach" }
  | { type: "recall"; cardId: string; cardTitle: string; category: string };

interface AIChatDrawerProps {
  mode: ChatMode;
  /** Externally controlled open state (used by recall mode) */
  isOpen?: boolean;
  /** Externally controlled close handler (used by recall mode) */
  onClose?: () => void;
  timezone?: string;
}

// ── Helpers ──────────────────────────────────────────────────

function getMessageText(msg: UIMessage): string {
  if (!msg.parts || msg.parts.length === 0) return "";
  return msg.parts
    .filter((part) => part.type === "text")
    .map((part) => (part.type === "text" ? part.text ?? "" : ""))
    .join("");
}

function getReasoningText(msg: UIMessage): string {
  if (!msg.parts || msg.parts.length === 0) return "";
  return msg.parts
    .filter((part) => part.type === "reasoning")
    .map((part) => (part.type === "reasoning" ? part.text ?? "" : ""))
    .join("");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

const TOOL_LABELS: Record<string, { loading: string; success: string; error: string }> = {
  searchHistoricalLogs: {
    loading: "Searching history…",
    success: "Searched history",
    error: "History search failed",
  },
  getCoachStats: {
    loading: "Loading stats…",
    success: "Stats loaded",
    error: "Stats failed",
  },
};

function getToolCallDataFromMessage(msg: UIMessage): ToolCallData[] {
  if (!msg.parts || msg.parts.length === 0) return [];

  return msg.parts.flatMap((part, index): ToolCallData[] => {
    if (!isRecord(part) || typeof (part as Record<string, unknown>).type !== "string") return [];
    const rec = part as Record<string, unknown>;
    const partType = rec.type as string;
    if (!partType.startsWith("tool-")) return [];
    const state = rec.state as string | undefined;
    if (!state) return [];

    const toolName = partType.replace(/^tool-/, "");
    const labels = TOOL_LABELS[toolName];
    if (!labels) return [];

    const key = typeof rec.toolCallId === "string"
      ? `${partType}-${rec.toolCallId}`
      : `${partType}-${index}`;

    let status: "loading" | "success" | "error";
    switch (state) {
      case "input-streaming":
      case "input-available":
        status = "loading";
        break;
      case "output-available":
        status = "success";
        break;
      case "output-error":
      case "input-error":
      case "output-denied":
        status = "error";
        break;
      default:
        return [];
    }

    return [{
      key,
      toolName,
      label: labels[status],
      status,
      input: isRecord(rec.input) ? (rec.input as Record<string, unknown>) : undefined,
      output: isRecord(rec.output) ? (rec.output as Record<string, unknown>) : undefined,
    }];
  });
}

// ── Quick Prompts ────────────────────────────────────────────

const COACH_QUICK_PROMPTS = [
  { text: "How's my week looking?", icon: TrendingUp },
  { text: "What should I focus on today?", icon: Zap },
  { text: "Am I on track for my targets?", icon: Target },
  { text: "Analyze my logging patterns", icon: BarChart3 },
];

const RECALL_QUICK_PROMPTS = [
  "Why does this matter?",
  "Explain simpler",
  "When did I use this?",
];

// ── Pro Model Options ────────────────────────────────────────

const PRO_MODEL_OPTIONS = [
  { value: "gpt-5-mini", label: "GPT-5 Mini" },
  { value: "gpt-5", label: "GPT-5" },
] as const;

// ── Injected Styles ──────────────────────────────────────────

const DRAWER_STYLES = `
  @keyframes dcl-drawer-in {
    0% { transform: translateX(100%); opacity: 0.8; }
    100% { transform: translateX(0); opacity: 1; }
  }
  @keyframes dcl-drawer-overlay-in {
    0% { opacity: 0; }
    100% { opacity: 1; }
  }
  @keyframes dcl-msg-enter {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes dcl-fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes dcl-cursor-blink {
    0%, 100% { opacity: 1; }
    50%      { opacity: 0.2; }
  }
  @keyframes dcl-pulse-ring {
    0% { transform: scale(0.95); opacity: 0.7; }
    50% { transform: scale(1.08); opacity: 1; }
    100% { transform: scale(0.95); opacity: 0.7; }
  }
  @keyframes dcl-dot-bounce {
    0%, 80%, 100% { transform: translateY(0); }
    40% { transform: translateY(-4px); }
  }
  @keyframes dcl-glow-pulse {
    0%, 100% { box-shadow: 0 0 12px oklch(0.65 0.19 60 / 20%), 0 4px 24px oklch(0 0 0 / 30%); }
    50% { box-shadow: 0 0 20px oklch(0.65 0.19 60 / 35%), 0 4px 24px oklch(0 0 0 / 30%); }
  }
  @keyframes dcl-shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  @keyframes dcl-step-glow-anim {
    0% { box-shadow: 0 0 0 oklch(0.65 0.19 60 / 0%); }
    40% { box-shadow: 0 0 12px oklch(0.72 0.16 145 / 30%), 0 0 4px oklch(0.72 0.16 145 / 15%); }
    100% { box-shadow: 0 0 0 oklch(0.65 0.19 60 / 0%); }
  }
  .dcl-step-glow {
    animation: dcl-step-glow-anim 0.8s ease-out;
  }
  .dcl-md-root p:last-child {
    margin-bottom: 0;
  }
  .dcl-drawer-panel {
    animation: dcl-drawer-in 0.32s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .dcl-drawer-overlay {
    animation: dcl-drawer-overlay-in 0.25s ease both;
  }
  .dcl-msg {
    animation: dcl-msg-enter 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .dcl-fade {
    animation: dcl-fade-in 0.4s ease both;
  }
  .dcl-cursor::after {
    content: "▎";
    animation: dcl-cursor-blink 0.9s ease-in-out infinite;
    color: var(--ai-chat-accent, var(--v2-amber-400));
    font-weight: 300;
    margin-left: 1px;
  }
  .dcl-fab {
    animation: dcl-glow-pulse 3s ease-in-out infinite;
    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .dcl-fab:hover {
    transform: translateY(-3px) scale(1.04);
  }
  .dcl-fab:active {
    transform: translateY(0) scale(0.97);
  }
  .dcl-dot {
    animation: dcl-dot-bounce 1.2s ease-in-out infinite;
  }
  .dcl-dot:nth-child(2) { animation-delay: 0.15s; }
  .dcl-dot:nth-child(3) { animation-delay: 0.3s; }
  .dcl-prompt-btn {
    transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    position: relative;
    overflow: hidden;
  }
  .dcl-prompt-btn:hover {
    transform: translateY(-1px);
  }
  .dcl-prompt-btn:active {
    transform: translateY(0) scale(0.97);
  }
  .dcl-send-btn {
    transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .dcl-send-btn:not(:disabled):hover {
    transform: scale(1.08);
  }
  .dcl-send-btn:not(:disabled):active {
    transform: scale(0.94);
  }
  .dcl-send-btn:disabled {
    opacity: 0.2;
    cursor: not-allowed;
  }
  .dcl-close-btn {
    transition: all 0.15s ease;
  }
  .dcl-close-btn:hover {
    transform: rotate(90deg);
  }
  .dcl-chat-scroll::-webkit-scrollbar {
    width: 4px;
  }
  .dcl-chat-scroll::-webkit-scrollbar-track {
    background: transparent;
  }
  .dcl-chat-scroll::-webkit-scrollbar-thumb {
    background: oklch(1 0 0 / 10%);
    border-radius: 99px;
  }
  .dcl-chat-scroll::-webkit-scrollbar-thumb:hover {
    background: oklch(1 0 0 / 18%);
  }
  .dcl-input:focus {
    outline: none;
  }
  .dcl-shimmer-bar {
    background: linear-gradient(
      90deg,
      oklch(1 0 0 / 4%) 0%,
      oklch(0.65 0.19 60 / 12%) 50%,
      oklch(1 0 0 / 4%) 100%
    );
    background-size: 200% 100%;
    animation: dcl-shimmer 1.8s ease-in-out infinite;
  }
  .dcl-pro-badge {
    background: linear-gradient(135deg, oklch(0.68 0.19 60), oklch(0.58 0.18 50));
    color: oklch(0.13 0.01 60);
    font-weight: 700;
    font-size: 8px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 1.5px 5px;
    border-radius: 4px;
    line-height: 1.4;
    position: relative;
    overflow: hidden;
  }
  .dcl-pro-badge::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      transparent 0%,
      oklch(1 0 0 / 25%) 50%,
      transparent 100%
    );
    background-size: 200% 100%;
    animation: dcl-shimmer 3s ease-in-out infinite;
    pointer-events: none;
  }
  .dcl-model-select {
    appearance: none;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .dcl-model-select:focus {
    outline: none;
  }
  .dcl-reasoning-toggle {
    cursor: pointer;
    transition: all 0.15s ease;
    user-select: none;
  }
  .dcl-reasoning-toggle:hover {
    opacity: 0.9;
  }
  .dcl-reasoning-content {
    overflow: hidden;
    transition: max-height 0.3s cubic-bezier(0.16, 1, 0.3, 1),
                opacity 0.2s ease;
  }
  .dcl-reasoning-content.collapsed {
    max-height: 0;
    opacity: 0;
  }
  .dcl-reasoning-content.expanded {
    max-height: 600px;
    opacity: 1;
  }
  .dcl-reasoning-chevron {
    transition: transform 0.2s ease;
  }
  .dcl-reasoning-chevron.open {
    transform: rotate(90deg);
  }
`;

// ── Coach Theme (hardcoded dark) ─────────────────────────────

const COACH_THEME = {
  accent: "var(--v2-amber-400)",
  accentGradient: "linear-gradient(135deg, oklch(0.68 0.19 60), oklch(0.58 0.18 55))",
  surface: "linear-gradient(170deg, oklch(0.16 0.01 250 / 96%), oklch(0.12 0.005 250 / 98%))",
  surfaceRaised: "linear-gradient(135deg, oklch(0.18 0.01 250 / 90%), oklch(0.14 0.005 250 / 95%))",
  headerBg: "linear-gradient(180deg, oklch(1 0 0 / 3%), transparent)",
  border: "oklch(1 0 0 / 8%)",
  borderStrong: "oklch(1 0 0 / 12%)",
  textPrimary: "oklch(0.93 0.01 80)",
  textSecondary: "oklch(0.85 0.01 250)",
  textMuted: "oklch(0.55 0.01 250)",
  inputBg: "oklch(1 0 0 / 4%)",
  inputBorder: "oklch(1 0 0 / 8%)",
  inputFocusBorder: "oklch(0.65 0.19 60 / 40%)",
  inputFocusShadow: "0 0 0 2px oklch(0.65 0.19 60 / 8%)",
  userBubbleBg: "linear-gradient(135deg, oklch(0.65 0.19 60 / 14%), oklch(0.55 0.17 55 / 10%))",
  userBubbleBorder: "oklch(0.65 0.19 60 / 18%)",
  userBubbleText: "oklch(0.9 0.03 80)",
  assistantBubbleBorder: "oklch(1 0 0 / 6%)",
  assistantBubbleText: "oklch(0.85 0.01 250)",
  sendBtnBg: "oklch(1 0 0 / 5%)",
  sendBtnActiveBg: "linear-gradient(135deg, oklch(0.68 0.19 60), oklch(0.56 0.18 55))",
  sendBtnActiveText: "oklch(0.13 0.01 60)",
  closeBtnHoverBg: "oklch(1 0 0 / 8%)",
  dotColor: "var(--v2-amber-400)",
  fabBg: "linear-gradient(135deg, oklch(0.68 0.19 60), oklch(0.58 0.18 55))",
  fabText: "oklch(0.13 0.01 60)",
  promptBtnBg: "oklch(1 0 0 / 3%)",
  promptBtnBorder: "oklch(1 0 0 / 8%)",
  promptBtnText: "oklch(0.65 0.02 250)",
  onlineColor: "oklch(0.75 0.18 145)",
};

// ── Reasoning Accordion (Pro feature) ────────────────────────

function ReasoningAccordion({
  reasoning,
  isStreaming,
  isCoach,
}: {
  reasoning: string;
  isStreaming: boolean;
  isCoach: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  // Auto-expand while streaming reasoning
  useEffect(() => {
    if (isStreaming && reasoning) {
      setIsOpen(true);
    }
  }, [isStreaming, reasoning]);

  if (!reasoning) return null;

  const accentColor = isCoach
    ? "oklch(0.65 0.14 60)"
    : "var(--world-accent, oklch(0.65 0.14 60))";
  const textColor = isCoach
    ? "oklch(0.65 0.02 250)"
    : "var(--world-text-secondary, oklch(0.65 0.02 250))";

  return (
    <div style={{ marginBottom: reasoning && isOpen ? "0.5rem" : "0.25rem" }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="dcl-reasoning-toggle flex items-center gap-1.5 py-1"
        style={{ color: accentColor }}
      >
        <ChevronRight
          className={`dcl-reasoning-chevron w-3 h-3 ${isOpen ? "open" : ""}`}
        />
        <Brain className="w-3 h-3" style={{ opacity: 0.8 }} />
        <span
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ fontFamily: "var(--font-body)" }}
        >
          Reasoning
          {isStreaming && (
            <span style={{ opacity: 0.6, marginLeft: "4px" }}>
              streaming…
            </span>
          )}
        </span>
      </button>

      <div
        className={`dcl-reasoning-content ${isOpen ? "expanded" : "collapsed"}`}
      >
        <div
          className="text-[11px] leading-[1.6] overflow-y-auto"
          style={{
            color: textColor,
            fontFamily: "var(--font-body)",
            fontStyle: "italic",
            borderLeft: `2px solid ${accentColor}`,
            paddingLeft: "0.625rem",
            marginLeft: "0.125rem",
            marginTop: "0.25rem",
            maxHeight: "200px",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {reasoning}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────

export default function AIChatDrawer({
  mode,
  isOpen: externalIsOpen,
  onClose: externalOnClose,
  timezone: timezoneProp,
}: AIChatDrawerProps) {
  const isCoach = mode.type === "coach";
  const isRecall = mode.type === "recall";

  // Session for pro detection
  const { data: session } = useSession();
  const userPlan = (session?.user as any)?.plan || "free";
  const isPro = userPlan === "pro";

  // Model selection (pro users only)
  const [selectedModel, setSelectedModel] = useState<string>("gpt-5-mini");

  // Open/close state — coach manages its own, recall is externally controlled
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const drawerOpen = isCoach ? internalIsOpen : (externalIsOpen ?? false);
  const closeDrawer = isCoach ? () => setInternalIsOpen(false) : (externalOnClose ?? (() => {}));
  const openDrawer = isCoach ? () => setInternalIsOpen(true) : undefined;

  const hasGreetedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const timezone = useMemo(
    () => timezoneProp || Intl.DateTimeFormat().resolvedOptions().timeZone,
    [timezoneProp]
  );

  // Speech recognition (coach mode only)
  const {
    isListening,
    transcript: speechInput,
    setTranscript: setSpeechInput,
    startListening,
    stopListening,
    supported: speechSupported,
  } = useSpeechRecognition();

  const [textInput, setTextInput] = useState("");
  // In coach mode, speech recognition drives the input
  const input = isCoach ? speechInput : textInput;
  const setInput = isCoach ? setSpeechInput : setTextInput;

  // Transport
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/ai-chat" }),
    []
  );

  const { messages, status, sendMessage, setMessages } = useChat({
    transport,
    onError: (e: Error) => {
      let errorMessage = "Couldn't reach the AI right now. Try again in a moment.";
      if (e?.message?.includes("Service unavailable") || e?.message?.includes("quota")) {
        errorMessage = "⚠ Service unavailable — OpenAI quota exceeded. Please check billing.";
      }
      if (e?.message?.includes("429") || e?.message?.includes("rate")) {
        errorMessage = "⚠ You've reached the AI message limit for today. Try again later.";
      }
      setMessages((prev: UIMessage[]) => [
        ...prev,
        {
          id: String(Date.now()),
          role: "assistant",
          parts: [{ type: "text", text: errorMessage }],
        },
      ]);
    },
  });

  const isStreaming = status === "streaming";
  const isSubmitted = status === "submitted";
  const isBusy = isStreaming || isSubmitted;

  // Listen for disciplog:open-ai-coach event (coach mode only)
  useEffect(() => {
    if (!isCoach) return;
    const handleOpen = () => setInternalIsOpen(true);
    window.addEventListener("disciplog:open-ai-coach", handleOpen);
    return () => window.removeEventListener("disciplog:open-ai-coach", handleOpen);
  }, [isCoach]);

  // ── Scroll helpers ──
  const scrollToBottom = useCallback((force = false) => {
    if (scrollRef.current) {
      const el = scrollRef.current;
      if (force || el.scrollHeight - el.scrollTop - el.clientHeight < 150) {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, []);

  useEffect(() => {
    scrollToBottom(true);
  }, [messages.length, scrollToBottom]);

  // Smart continuous scroll during streaming
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !isStreaming) return;

    let isUserScrolledUp = el.scrollHeight - el.scrollTop - el.clientHeight > 150;

    const handleScroll = () => {
      isUserScrolledUp = el.scrollHeight - el.scrollTop - el.clientHeight > 150;
    };

    el.addEventListener("scroll", handleScroll, { passive: true });

    const observer = new MutationObserver(() => {
      if (!isUserScrolledUp) {
        el.scrollTop = el.scrollHeight;
      }
    });

    observer.observe(el, { childList: true, subtree: true, characterData: true });

    return () => {
      el.removeEventListener("scroll", handleScroll);
      observer.disconnect();
    };
  }, [isStreaming]);

  // Auto-focus input when drawer opens
  useEffect(() => {
    if (drawerOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 400);
    }
  }, [drawerOpen]);

  // ── Send with mode-specific body ──
  const sendWithContext = useCallback(
    (text: string) => {
      const body: Record<string, unknown> = {
        timezone,
        mode: mode.type,
      };

      if (isRecall && mode.type === "recall") {
        body.recallCardId = mode.cardId;
      }

      if (isPro && selectedModel) {
        body.preferredModel = selectedModel;
      }

      sendMessage({ text }, { body });
    },
    [sendMessage, timezone, mode, isRecall, isPro, selectedModel]
  );

  // ── Initial greeting (coach only) ──
  useEffect(() => {
    if (
      isCoach &&
      drawerOpen &&
      !hasGreetedRef.current &&
      messages.length === 0
    ) {
      hasGreetedRef.current = true;
      sendWithContext(
        "Give me a quick daily insight on my productivity today and this week. Be direct and brief."
      );
    }
  }, [isCoach, drawerOpen, messages.length, sendWithContext]);

  // ── Handlers ──
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isBusy) {
      sendWithContext(input);
      setInput("");
      // Reset textarea height
      if (inputRef.current) {
        inputRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    sendWithContext(prompt);
  };

  // ── Recall REDIRECT handler ──
  function renderRecallMessageContent(text: string, isLastStreamingMsg: boolean) {
    if (text.startsWith("[REDIRECT]")) {
      const displayMsg =
        text.replace("[REDIRECT]", "").trim() ||
        "This question seems outside the scope of this recall card. The AI Coach can help you better with that.";
      return (
        <div className="flex flex-col gap-2.5">
          <span className="text-[13px] leading-relaxed opacity-90">{displayMsg}</span>
          <Button
            size="sm"
            variant="outline"
            className="self-start rounded-full gap-1.5"
            style={{
              borderColor: `color-mix(in oklch, var(--ai-chat-accent) 30%, transparent)`,
              color: "var(--ai-chat-accent)",
              background: "transparent",
            }}
            onClick={() => {
              window.dispatchEvent(new CustomEvent("disciplog:open-ai-coach"));
              closeDrawer();
            }}
          >
            <ExternalLink className="w-3 h-3" />
            Open AI Coach
          </Button>
        </div>
      );
    }

    return <ChatMarkdown content={text} isStreaming={isLastStreamingMsg} />;
  }

  // ── Message rendering helpers ──
  const lastMsg = messages[messages.length - 1];
  const lastAssistantIsStreaming = isStreaming && lastMsg?.role === "assistant";
  const lastAssistantText = lastMsg ? getMessageText(lastMsg) : "";
  const lastAssistantToolData = lastMsg ? getToolCallDataFromMessage(lastMsg) : [];

  // ── Resolve theme vars ──
  // Coach uses hardcoded dark theme, recall will inherit from CSS custom properties
  // set by the world tier (via useWorld in parent)
  const t = COACH_THEME;

  // If not open, show FAB for coach mode or nothing for recall
  if (!drawerOpen) {
    if (isCoach) {
      return (
        <>
          <style dangerouslySetInnerHTML={{ __html: DRAWER_STYLES }} />
          <button
            onClick={openDrawer}
            className="dcl-fab fixed bottom-6 right-6 z-50 flex items-center gap-2.5 pl-4 pr-5 py-3 rounded-full font-semibold text-[13px]"
            style={{
              background: t.fabBg,
              color: t.fabText,
              fontFamily: "var(--font-display)",
              letterSpacing: "-0.01em",
            }}
          >
            <Sparkles className="w-4 h-4" style={{ opacity: 0.8 }} />
            AI Coach
            {isPro && (
              <span className="dcl-pro-badge" style={{ marginLeft: "-2px" }}>PRO</span>
            )}
          </button>
        </>
      );
    }
    return null;
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: DRAWER_STYLES }} />

      <div className="fixed inset-0 z-[100] flex justify-end" style={{ "--ai-chat-accent": t.accent } as React.CSSProperties}>
        {/* Overlay */}
        <div
          className="dcl-drawer-overlay absolute inset-0"
          style={{
            background: "rgba(0, 0, 0, 0.45)",
            backdropFilter: "blur(6px)",
          }}
          onClick={closeDrawer}
        />

        {/* Drawer Panel */}
        <div
          className="dcl-drawer-panel relative flex flex-col w-full h-full sm:w-[420px] z-[101]"
          style={{
            background: isCoach ? t.surface : "var(--world-surface, oklch(0.12 0.005 250))",
            borderLeft: `1px solid ${isCoach ? t.border : "var(--world-border, oklch(1 0 0 / 8%))"}`,
            boxShadow: "-12px 0 40px rgba(0,0,0,0.5)",
            backdropFilter: "blur(40px)",
          }}
        >
          {/* ── Header ── */}
          <div
            className="flex items-center justify-between px-4 py-3.5"
            style={{
              background: isCoach ? t.headerBg : "var(--world-header-bg, transparent)",
              borderBottom: `1px solid ${isCoach ? t.border : "var(--world-border, oklch(1 0 0 / 6%))"}`,
            }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="relative shrink-0 p-2 rounded-xl"
                style={{
                  background: isCoach
                    ? "linear-gradient(135deg, oklch(0.65 0.19 60 / 15%), oklch(0.55 0.17 55 / 8%))"
                    : "color-mix(in oklch, var(--world-accent, oklch(0.65 0.19 60)) 12%, transparent)",
                  border: isCoach
                    ? undefined
                    : "1px solid color-mix(in oklch, var(--world-accent) 20%, transparent)",
                }}
              >
                <Bot
                  className="w-4 h-4"
                  style={{ color: isCoach ? t.accent : "var(--world-accent, var(--v2-amber-400))" }}
                />
                {/* Online dot */}
                <div
                  className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
                  style={{
                    background: isBusy
                      ? (isCoach ? t.accent : "var(--world-accent)")
                      : t.onlineColor,
                    borderColor: isCoach ? "oklch(0.16 0.01 250)" : "var(--world-surface, oklch(0.12 0.005 250))",
                    animation: isBusy ? "dcl-pulse-ring 1.5s ease-in-out infinite" : "none",
                  }}
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3
                    className="font-bold text-[13px] tracking-tight truncate"
                    style={{
                      fontFamily: "var(--font-display)",
                      color: isCoach ? t.textPrimary : "var(--world-text-primary, oklch(0.93 0.01 80))",
                    }}
                  >
                    {isCoach ? (
                      <>
                        DiscipLog{" "}
                        <span
                          style={{
                            background: "linear-gradient(135deg, var(--v2-amber-400), var(--v2-amber-300))",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                          }}
                        >
                          AI
                        </span>
                      </>
                    ) : (
                      "Ask AI"
                    )}
                  </h3>
                  {isPro && (
                    <span className="dcl-pro-badge shrink-0">PRO</span>
                  )}
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                    style={{
                      background: isBusy
                        ? (isCoach ? t.accent : "var(--world-accent)")
                        : t.onlineColor,
                      animation: isBusy ? "dcl-pulse-ring 1.5s ease-in-out infinite" : "none",
                    }}
                  />
                  <span
                    className="text-[10px] shrink-0"
                    style={{
                      color: isCoach ? t.textMuted : "var(--world-text-muted, oklch(0.55 0.01 250))",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    {isBusy ? "Thinking…" : "Online"}
                  </span>
                </div>
                {isRecall && mode.type === "recall" && (
                  <p
                    className="text-[11px] truncate mt-0.5"
                    style={{ color: isCoach ? t.textMuted : "var(--world-text-muted)" }}
                  >
                    {mode.cardTitle} · {mode.category}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={closeDrawer}
                className="dcl-close-btn p-1.5 rounded-lg"
                style={{
                  color: isCoach ? t.textMuted : "var(--world-text-muted, oklch(0.5 0.01 250))",
                }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Messages Area ── */}
          <div
            ref={scrollRef}
            className="dcl-chat-scroll flex-1 overflow-y-auto px-4 py-4 space-y-3"
            style={{ minHeight: "200px" }}
          >
            {/* Empty state */}
            {messages.length === 0 && !isBusy && (
              <div className="dcl-fade flex flex-col items-center justify-center h-full text-center px-4">
                <div
                  className="w-12 h-12 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                  style={{
                    background: isCoach
                      ? "linear-gradient(135deg, oklch(0.65 0.19 60 / 12%), oklch(0.55 0.17 55 / 6%))"
                      : "color-mix(in oklch, var(--world-accent) 12%, transparent)",
                    border: isCoach
                      ? "1px solid oklch(0.65 0.19 60 / 10%)"
                      : "1px solid color-mix(in oklch, var(--world-accent) 20%, transparent)",
                  }}
                >
                  <Sparkles
                    className="w-5 h-5"
                    style={{
                      color: isCoach ? t.accent : "var(--world-accent)",
                      opacity: 0.6,
                    }}
                  />
                </div>
                <p
                  className="text-sm font-semibold mb-1"
                  style={{
                    color: isCoach ? "oklch(0.8 0.02 80)" : "var(--world-text-primary)",
                    fontFamily: "var(--font-display)",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {isCoach ? "Your productivity coach" : "Need help with this card?"}
                </p>
                <p
                  className="text-xs leading-relaxed mb-5"
                  style={{
                    color: isCoach ? "oklch(0.45 0.01 250)" : "var(--world-text-muted)",
                    fontFamily: "var(--font-body)",
                    maxWidth: "240px",
                    margin: "0 auto 20px",
                  }}
                >
                  {isCoach
                    ? "Ask about your progress, patterns, or what to focus on next"
                    : "Ask me to clarify the concept, explain why it matters, or connect it to your past work."}
                </p>

                {/* Quick prompts */}
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  {isCoach
                    ? COACH_QUICK_PROMPTS.map(({ text, icon: Icon }) => (
                        <button
                          key={text}
                          onClick={() => handleQuickPrompt(text)}
                          className="dcl-prompt-btn flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-full"
                          style={{
                            border: `1px solid ${t.promptBtnBorder}`,
                            background: t.promptBtnBg,
                            color: t.promptBtnText,
                            fontFamily: "var(--font-body)",
                          }}
                        >
                          <Icon className="w-3 h-3" style={{ opacity: 0.5 }} />
                          {text}
                        </button>
                      ))
                    : RECALL_QUICK_PROMPTS.map((preset) => (
                        <button
                          key={preset}
                          onClick={() => handleQuickPrompt(preset)}
                          className="dcl-prompt-btn px-3 py-1.5 rounded-full text-[11px] font-medium"
                          style={{
                            background: "color-mix(in oklch, var(--world-accent) 12%, transparent)",
                            border: "1px solid color-mix(in oklch, var(--world-accent) 20%, transparent)",
                            color: "var(--world-accent)",
                          }}
                        >
                          {preset}
                        </button>
                      ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((msg: UIMessage, i: number) => {
              const text = getMessageText(msg);
              const reasoning = isPro ? getReasoningText(msg) : "";
              const toolData = isCoach ? getToolCallDataFromMessage(msg) : [];
              const isLastStreaming = lastAssistantIsStreaming && i === messages.length - 1;
              const isAssistant = msg.role === "assistant";
              const hasVisibleContent = Boolean(text) || toolData.length > 0 || Boolean(reasoning);

              if (isAssistant && isLastStreaming && !hasVisibleContent) {
                return null;
              }

              return (
                <div
                  key={msg.id}
                  className={`dcl-msg flex items-start gap-2.5 ${
                    isAssistant ? "justify-start" : "justify-end"
                  }`}
                  style={{ animationDelay: `${Math.min(i * 0.05, 0.3)}s` }}
                >
                  {/* Assistant avatar */}
                  {isAssistant && (
                    <div
                      className="shrink-0 mt-1 p-1.5 rounded-lg"
                      style={{
                        background: isCoach
                          ? "linear-gradient(135deg, oklch(0.65 0.19 60 / 12%), oklch(0.55 0.17 55 / 6%))"
                          : "color-mix(in oklch, var(--world-accent) 12%, transparent)",
                        border: isCoach
                          ? "1px solid oklch(0.65 0.19 60 / 8%)"
                          : "1px solid color-mix(in oklch, var(--world-accent) 20%, transparent)",
                      }}
                    >
                      <Bot
                        className="w-3 h-3"
                        style={{ color: isCoach ? t.accent : "var(--world-accent)" }}
                      />
                    </div>
                  )}

                  {/* Message bubble */}
                  <div
                    className="max-w-[82%] px-3.5 py-2.5 text-[13px] leading-[1.65]"
                    style={{
                      background: isAssistant
                        ? (isCoach ? t.surfaceRaised : "var(--world-surface-raised, oklch(0.18 0.01 250))")
                        : (isCoach ? t.userBubbleBg : "color-mix(in oklch, var(--world-accent) 12%, transparent)"),
                      border: `1px solid ${
                        isAssistant
                          ? (isCoach ? t.assistantBubbleBorder : "var(--world-border, oklch(1 0 0 / 6%))")
                          : (isCoach ? t.userBubbleBorder : "color-mix(in oklch, var(--world-accent) 20%, transparent)")
                      }`,
                      color: isAssistant
                        ? (isCoach ? t.assistantBubbleText : "var(--world-text-secondary, oklch(0.85 0.01 250))")
                        : (isCoach ? t.userBubbleText : "var(--world-text-primary, oklch(0.9 0.03 80))"),
                      fontFamily: "var(--font-body)",
                      wordBreak: "break-word",
                      borderRadius: isAssistant ? "4px 18px 18px 18px" : "18px 4px 18px 18px",
                      backdropFilter: isCoach ? "blur(10px)" : undefined,
                    }}
                  >
                    {/* Tool call accordion (coach only) */}
                    {isCoach && toolData.length > 0 && (
                      <ToolCallAccordion steps={toolData} />
                    )}

                    {/* Reasoning accordion (pro only) */}
                    {isAssistant && reasoning && (
                      <ReasoningAccordion
                        reasoning={reasoning}
                        isStreaming={isLastStreaming}
                        isCoach={isCoach}
                      />
                    )}

                    {isAssistant && text ? (
                      isRecall ? (
                        renderRecallMessageContent(text, isLastStreaming)
                      ) : (
                        <ChatMarkdown content={text} isStreaming={isLastStreaming} />
                      )
                    ) : isAssistant && isLastStreaming && toolData.every((tc) => tc.status !== "loading") ? (
                      <div className="flex items-center gap-3 py-1">
                        <div className="flex gap-1">
                          {[0, 1, 2].map((n) => (
                            <div
                              key={n}
                              className="dcl-dot w-1.5 h-1.5 rounded-full"
                              style={{ background: isCoach ? t.dotColor : "var(--world-accent)" }}
                            />
                          ))}
                        </div>
                        <span
                          className="text-[11px]"
                          style={{
                            color: isCoach ? t.textMuted : "var(--world-text-muted)",
                            fontFamily: "var(--font-body)",
                          }}
                        >
                          {isCoach ? "Analyzing your data…" : "Thinking…"}
                        </span>
                      </div>
                    ) : (
                      <span style={{ whiteSpace: "pre-wrap" }}>
                        {text || (isLastStreaming || toolData.length > 0 ? "" : "…")}
                      </span>
                    )}
                  </div>

                  {/* User avatar */}
                  {!isAssistant && (
                    <div
                      className="shrink-0 mt-1 p-1.5 rounded-lg"
                      style={{
                        background: isCoach ? "oklch(1 0 0 / 5%)" : "var(--world-surface-raised, oklch(1 0 0 / 5%))",
                        border: `1px solid ${isCoach ? "oklch(1 0 0 / 6%)" : "var(--world-border, oklch(1 0 0 / 6%))"}`,
                      }}
                    >
                      <User
                        className="w-3 h-3"
                        style={{ color: isCoach ? t.textMuted : "var(--world-text-muted, oklch(0.55 0.01 250))" }}
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Thinking indicator */}
            {(isSubmitted ||
              (lastAssistantIsStreaming && !lastAssistantText && lastAssistantToolData.length === 0)) && (
              <div className="dcl-msg flex items-start gap-2.5 justify-start">
                <div
                  className="shrink-0 mt-1 p-1.5 rounded-lg"
                  style={{
                    background: isCoach
                      ? "linear-gradient(135deg, oklch(0.65 0.19 60 / 12%), oklch(0.55 0.17 55 / 6%))"
                      : "color-mix(in oklch, var(--world-accent) 12%, transparent)",
                    border: isCoach
                      ? "1px solid oklch(0.65 0.19 60 / 8%)"
                      : "1px solid color-mix(in oklch, var(--world-accent) 20%, transparent)",
                  }}
                >
                  <Bot
                    className="w-3 h-3"
                    style={{ color: isCoach ? t.accent : "var(--world-accent)" }}
                  />
                </div>
                <div
                  className="px-4 py-3 flex items-center gap-3"
                  style={{
                    background: isCoach ? t.surfaceRaised : "var(--world-surface-raised)",
                    border: `1px solid ${isCoach ? t.assistantBubbleBorder : "var(--world-border)"}`,
                    borderRadius: "4px 18px 18px 18px",
                    backdropFilter: isCoach ? "blur(10px)" : undefined,
                  }}
                >
                  <div className="flex gap-1">
                    {[0, 1, 2].map((n) => (
                      <div
                        key={n}
                        className="dcl-dot w-1.5 h-1.5 rounded-full"
                        style={{ background: isCoach ? t.dotColor : "var(--world-accent)" }}
                      />
                    ))}
                  </div>
                  <span
                    className="text-[11px]"
                    style={{
                      color: isCoach ? t.textMuted : "var(--world-text-muted)",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    {isCoach ? "Analyzing your data…" : "Thinking…"}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ── Quick Prompts (coach, shown after first exchange) ── */}
          {isCoach && messages.length <= 1 && !isBusy && messages.length > 0 && (
            <div
              className="dcl-fade px-4 py-3 flex flex-wrap gap-1.5"
              style={{ borderTop: `1px solid ${t.border}` }}
            >
              {COACH_QUICK_PROMPTS.map(({ text, icon: Icon }) => (
                <button
                  key={text}
                  onClick={() => handleQuickPrompt(text)}
                  className="dcl-prompt-btn flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-full"
                  style={{
                    border: `1px solid ${t.promptBtnBorder}`,
                    background: t.promptBtnBg,
                    color: t.promptBtnText,
                    fontFamily: "var(--font-body)",
                  }}
                >
                  <Icon className="w-3 h-3" style={{ opacity: 0.5 }} />
                  {text}
                </button>
              ))}
            </div>
          )}

          {/* ── Input Area ── */}
          <div
            className="px-3 py-3"
            style={{
              borderTop: `1px solid ${isCoach ? t.border : "var(--world-border, oklch(1 0 0 / 5%))"}`,
              background: isCoach
                ? "oklch(0.1 0.005 250 / 60%)"
                : "var(--world-header-bg, transparent)",
            }}
          >
            {/* Model selector row (pro users, above textarea) */}
            {isPro && (
              <div className="flex items-center gap-1.5 mb-2 pl-0.5">
                <Sparkles className="w-3 h-3" style={{ color: isCoach ? t.accent : "var(--world-accent)", opacity: 0.5 }} />
                <div className="relative">
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="dcl-model-select text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-md"
                    style={{
                      background: isCoach
                        ? "oklch(1 0 0 / 5%)"
                        : "color-mix(in oklch, var(--world-accent, oklch(0.65 0.19 60)) 8%, transparent)",
                      border: `1px solid ${isCoach ? "oklch(1 0 0 / 8%)" : "color-mix(in oklch, var(--world-accent) 15%, transparent)"}`,
                      color: isCoach ? "oklch(0.65 0.02 70)" : "var(--world-accent, oklch(0.65 0.19 60))",
                      paddingRight: "18px",
                    }}
                  >
                    {PRO_MODEL_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value} style={{ background: "#1a1a2e", color: "#e0e0e0" }}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-2.5 h-2.5 pointer-events-none"
                    style={{ color: isCoach ? "oklch(0.45 0.01 250)" : "var(--world-text-muted)" }}
                  />
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  // Auto-grow
                  const el = e.target;
                  el.style.height = "auto";
                  el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
                }}
                onKeyDown={handleKeyDown}
                placeholder={
                  isCoach
                    ? isListening
                      ? "Listening…"
                      : "Ask about your productivity…"
                    : "Ask about this recall…"
                }
                className="dcl-input flex-1 rounded-xl px-3.5 py-2.5 text-[13px] resize-none overflow-y-auto"
                style={{
                  background: isCoach ? t.inputBg : "var(--world-surface-raised, oklch(1 0 0 / 4%))",
                  border: isCoach
                    ? isListening
                      ? `1px solid ${t.accent}`
                      : `1px solid ${t.inputBorder}`
                    : "1px solid var(--world-border, oklch(1 0 0 / 8%))",
                  color: isCoach ? "oklch(0.9 0.01 250)" : "var(--world-text-primary, oklch(0.9 0.01 250))",
                  fontFamily: "var(--font-body)",
                  minHeight: "44px",
                  maxHeight: "140px",
                  boxShadow: isCoach && isListening ? "0 0 15px oklch(0.65 0.19 60 / 15%)" : "none",
                  transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                }}
                rows={1}
              />

              {/* Speech recognition button (coach only) */}
              {isCoach && speechSupported && (
                <button
                  type="button"
                  onClick={isListening ? stopListening : startListening}
                  className="dcl-send-btn shrink-0 h-11 w-11 rounded-xl flex items-center justify-center"
                  style={{
                    background: isListening ? "oklch(0.65 0.19 60 / 15%)" : "oklch(1 0 0 / 5%)",
                    border: isListening ? `1px solid ${t.accent}` : "1px solid transparent",
                    color: isListening ? "var(--v2-amber-300)" : "oklch(0.5 0.01 250)",
                    transition: "all 0.2s ease",
                  }}
                >
                  {isListening ? (
                    <Square className="w-4 h-4 fill-current animate-pulse" />
                  ) : (
                    <Mic className="w-4 h-4" />
                  )}
                </button>
              )}

              {/* Send button */}
              <button
                type="submit"
                disabled={!input.trim() || isBusy}
                className="dcl-send-btn shrink-0 h-11 w-11 rounded-xl flex items-center justify-center"
                style={{
                  background:
                    input.trim() && !isBusy
                      ? isCoach
                        ? t.sendBtnActiveBg
                        : "var(--world-accent, oklch(0.65 0.19 60))"
                      : isCoach
                        ? t.sendBtnBg
                        : "color-mix(in oklch, var(--world-accent) 12%, transparent)",
                  border: "none",
                  color:
                    input.trim() && !isBusy
                      ? isCoach
                        ? t.sendBtnActiveText
                        : "oklch(0.12 0.01 250)"
                      : isCoach
                        ? "oklch(0.35 0.01 250)"
                        : "var(--world-accent)",
                }}
                aria-label="Send message"
              >
                {isCoach ? <Send className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
              </button>
            </form>

            {/* Footer text */}
            {isRecall && (
              <p
                className="text-center text-[10px] mt-2"
                style={{ color: isCoach ? t.textMuted : "var(--world-text-muted)" }}
              >
                Scoped to this recall card and related logs
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
