"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import {
  Bot,
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
} from "lucide-react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

interface AIAssistantV2Props {
  logs: any[];
}

const QUICK_PROMPTS = [
  { text: "How's my week looking?", icon: TrendingUp },
  { text: "What should I focus on today?", icon: Zap },
  { text: "Am I on track for my targets?", icon: Target },
  { text: "Analyze my logging patterns", icon: BarChart3 },
];

/** Extract plain text from a UIMessage's parts array */
function getMessageText(msg: UIMessage): string {
  if (!msg.parts || msg.parts.length === 0) return "";
  return msg.parts
    .filter((p: any) => p.type === "text")
    .map((p: any) => p.text ?? "")
    .join("");
}

/* ─────────────── Injected Styles ─────────────── */
const CHAT_STYLES = `
  @keyframes dcl-panel-enter {
    from { opacity: 0; transform: translateY(16px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
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

  .dcl-panel {
    animation: dcl-panel-enter 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
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
    color: var(--v2-amber-400);
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
  .dcl-prompt-btn::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, oklch(0.65 0.19 60 / 0%), oklch(0.65 0.19 60 / 8%));
    opacity: 0;
    transition: opacity 0.2s ease;
  }
  .dcl-prompt-btn:hover::before {
    opacity: 1;
  }
  .dcl-prompt-btn:hover {
    transform: translateY(-1px);
    border-color: oklch(0.65 0.19 60 / 30%) !important;
  }
  .dcl-prompt-btn:active {
    transform: translateY(0) scale(0.97);
  }

  .dcl-input:focus {
    border-color: oklch(0.65 0.19 60 / 40%) !important;
    box-shadow: 0 0 0 2px oklch(0.65 0.19 60 / 8%);
    outline: none;
  }

  .dcl-send-btn {
    transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .dcl-send-btn:not(:disabled):hover {
    transform: scale(1.08);
    box-shadow: 0 4px 16px oklch(0.65 0.19 60 / 30%);
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
    background: oklch(1 0 0 / 8%);
    transform: rotate(90deg);
  }

  .dcl-scroll::-webkit-scrollbar {
    width: 4px;
  }
  .dcl-scroll::-webkit-scrollbar-track {
    background: transparent;
  }
  .dcl-scroll::-webkit-scrollbar-thumb {
    background: oklch(1 0 0 / 10%);
    border-radius: 99px;
  }
  .dcl-scroll::-webkit-scrollbar-thumb:hover {
    background: oklch(1 0 0 / 18%);
  }

  .dcl-assistant-bubble {
    background:
      linear-gradient(
        135deg,
        oklch(0.18 0.01 250 / 90%),
        oklch(0.14 0.005 250 / 95%)
      );
    backdrop-filter: blur(10px);
  }

  .dcl-user-bubble {
    background:
      linear-gradient(
        135deg,
        oklch(0.65 0.19 60 / 14%),
        oklch(0.55 0.17 55 / 10%)
      );
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
`;

export default function AIAssistantV2({ logs }: AIAssistantV2Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const {
    isListening,
    transcript: input,
    setTranscript: setInput,
    startListening,
    stopListening,
    supported,
  } = useSpeechRecognition();

  // Transport creates a new instance explicitly mapped to our Chat API
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
      }),
    []
  );

  const { messages, status, sendMessage, setMessages } = useChat({
    transport,
    onError: (e: Error) => {
      let errorMessage =
        "Couldn't reach the AI right now. Try again in a moment.";
      if (
        e?.message?.includes("Service unavailable") ||
        e?.message?.includes("quota")
      ) {
        errorMessage =
          "⚠ Service unavailable — OpenAI quota exceeded. Please check billing.";
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

  /* ── Scroll helpers ── */
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  // RAF-based continuous scroll while streaming
  useEffect(() => {
    if (isStreaming) {
      const tick = () => {
        scrollToBottom();
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }
  }, [isStreaming, scrollToBottom]);

  /* ── Auto-focus input when panel opens ── */
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 400);
    }
  }, [isOpen]);

  // Helper to send messages with the exact current logs in the request body
  const sendWithContext = useCallback(
    (text: string) => {
      sendMessage(
        { text },
        {
          body: {
            logs,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        }
      );
    },
    [sendMessage, logs]
  );

  /* ── Initial greeting ── */
  useEffect(() => {
    if (isOpen && !hasGreeted && messages.length === 0 && logs.length > 0) {
      setHasGreeted(true);
      sendWithContext(
        "Give me a quick daily insight on my productivity today and this week. Be direct and brief."
      );
    }
  }, [isOpen, hasGreeted, logs, messages.length, sendWithContext]);

  /* ── Handlers ── */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isBusy) {
      sendWithContext(input);
      setInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isBusy) {
        sendWithContext(input);
        setInput("");
      }
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    sendWithContext(prompt);
  };

  const lastMsg = messages[messages.length - 1];
  const lastAssistantIsStreaming =
    isStreaming && lastMsg?.role === "assistant";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CHAT_STYLES }} />

      {/* ── Floating Action Button ── */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="dcl-fab fixed bottom-6 right-6 z-50 flex items-center gap-2.5 pl-4 pr-5 py-3 rounded-full font-semibold text-[13px]"
          style={{
            background:
              "linear-gradient(135deg, oklch(0.68 0.19 60), oklch(0.58 0.18 55))",
            color: "oklch(0.13 0.01 60)",
            fontFamily: "var(--font-display)",
            letterSpacing: "-0.01em",
          }}
        >
          <Sparkles className="w-4 h-4" style={{ opacity: 0.8 }} />
          AI Coach
        </button>
      )}

      {/* ── Chat Panel ── */}
      {isOpen && (
        <div
          className="dcl-panel fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl overflow-hidden"
          style={{
            width: "min(420px, calc(100vw - 48px))",
            maxHeight: "min(620px, calc(100vh - 48px))",
            background:
              "linear-gradient(170deg, oklch(0.16 0.01 250 / 96%), oklch(0.12 0.005 250 / 98%))",
            border: "1px solid oklch(1 0 0 / 8%)",
            boxShadow: `
              0 24px 80px oklch(0 0 0 / 60%),
              0 0 1px oklch(1 0 0 / 10%),
              inset 0 1px 0 oklch(1 0 0 / 5%)
            `,
            backdropFilter: "blur(40px)",
          }}
        >
          {/* ── Header ── */}
          <div
            className="flex items-center justify-between px-5 py-3.5"
            style={{
              background:
                "linear-gradient(180deg, oklch(1 0 0 / 3%), transparent)",
              borderBottom: "1px solid oklch(1 0 0 / 6%)",
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="relative p-2 rounded-xl"
                style={{
                  background:
                    "linear-gradient(135deg, oklch(0.65 0.19 60 / 15%), oklch(0.55 0.17 55 / 8%))",
                }}
              >
                <Bot
                  className="w-4 h-4"
                  style={{ color: "var(--v2-amber-400)" }}
                />
                {/* Online dot */}
                <div
                  className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
                  style={{
                    background: "oklch(0.75 0.18 145)",
                    borderColor: "oklch(0.16 0.01 250)",
                  }}
                />
              </div>
              <div>
                <div
                  className="text-[13px] font-bold tracking-tight"
                  style={{
                    fontFamily: "var(--font-display)",
                    color: "oklch(0.93 0.01 80)",
                  }}
                >
                  DiscipLog{" "}
                  <span
                    style={{
                      background:
                        "linear-gradient(135deg, var(--v2-amber-400), var(--v2-amber-300))",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    AI
                  </span>
                </div>
                <div
                  className="text-[10px] mt-0.5 flex items-center gap-1.5"
                  style={{
                    color: "oklch(0.55 0.01 250)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full"
                    style={{
                      background: isBusy
                        ? "var(--v2-amber-400)"
                        : "oklch(0.75 0.18 145)",
                      animation: isBusy
                        ? "dcl-pulse-ring 1.5s ease-in-out infinite"
                        : "none",
                    }}
                  />
                  {isBusy ? "Thinking…" : "Online"}
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="dcl-close-btn p-1.5 rounded-lg"
              style={{ color: "oklch(0.5 0.01 250)" }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ── Messages Area ── */}
          <div
            ref={scrollRef}
            className="dcl-scroll flex-1 overflow-y-auto px-4 py-4 space-y-3"
            style={{
              maxHeight: "400px",
              minHeight: "200px",
            }}
          >
            {/* Empty state */}
            {messages.length === 0 && !isBusy && (
              <div className="dcl-fade text-center py-10 px-4">
                <div
                  className="w-12 h-12 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                  style={{
                    background:
                      "linear-gradient(135deg, oklch(0.65 0.19 60 / 12%), oklch(0.55 0.17 55 / 6%))",
                    border: "1px solid oklch(0.65 0.19 60 / 10%)",
                  }}
                >
                  <Sparkles
                    className="w-5 h-5"
                    style={{ color: "var(--v2-amber-400)", opacity: 0.6 }}
                  />
                </div>
                <p
                  className="text-sm font-semibold mb-1"
                  style={{
                    color: "oklch(0.8 0.02 80)",
                    fontFamily: "var(--font-display)",
                    letterSpacing: "-0.01em",
                  }}
                >
                  Your productivity coach
                </p>
                <p
                  className="text-xs leading-relaxed"
                  style={{
                    color: "oklch(0.45 0.01 250)",
                    fontFamily: "var(--font-body)",
                    maxWidth: "240px",
                    margin: "0 auto",
                  }}
                >
                  Ask about your progress, patterns, or what to focus on
                  next
                </p>
              </div>
            )}

            {/* Messages */}
            {messages.map((msg: UIMessage, i: number) => {
              const text = getMessageText(msg);
              const isLastStreaming =
                lastAssistantIsStreaming && i === messages.length - 1;
              const isAssistant = msg.role === "assistant";

              // If it's reasoning and hasn't produced text yet, hide the empty bubble
              if (isAssistant && isLastStreaming && !text) {
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
                        background:
                          "linear-gradient(135deg, oklch(0.65 0.19 60 / 12%), oklch(0.55 0.17 55 / 6%))",
                        border: "1px solid oklch(0.65 0.19 60 / 8%)",
                      }}
                    >
                      <Bot
                        className="w-3 h-3"
                        style={{ color: "var(--v2-amber-400)" }}
                      />
                    </div>
                  )}

                  {/* Message bubble */}
                  <div
                    className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-[1.65] ${
                      isAssistant ? "dcl-assistant-bubble" : "dcl-user-bubble"
                    } ${isLastStreaming ? "dcl-cursor" : ""}`}
                    style={{
                      border: `1px solid ${
                        isAssistant
                          ? "oklch(1 0 0 / 6%)"
                          : "oklch(0.65 0.19 60 / 18%)"
                      }`,
                      color: isAssistant
                        ? "oklch(0.85 0.01 250)"
                        : "oklch(0.9 0.03 80)",
                      fontFamily: "var(--font-body)",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      borderRadius: isAssistant
                        ? "4px 18px 18px 18px"
                        : "18px 4px 18px 18px",
                    }}
                  >
                    {text || (isLastStreaming ? "" : "…")}
                  </div>

                  {/* User avatar */}
                  {!isAssistant && (
                    <div
                      className="shrink-0 mt-1 p-1.5 rounded-lg"
                      style={{
                        background: "oklch(1 0 0 / 5%)",
                        border: "1px solid oklch(1 0 0 / 6%)",
                      }}
                    >
                      <User
                        className="w-3 h-3"
                        style={{ color: "oklch(0.55 0.01 250)" }}
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Thinking indicator — shown during 'submitted' or reasoning phase */}
            {(isSubmitted ||
              (lastAssistantIsStreaming && !getMessageText(lastMsg))) && (
              <div className="dcl-msg flex items-start gap-2.5 justify-start">
                <div
                  className="shrink-0 mt-1 p-1.5 rounded-lg"
                  style={{
                    background:
                      "linear-gradient(135deg, oklch(0.65 0.19 60 / 12%), oklch(0.55 0.17 55 / 6%))",
                    border: "1px solid oklch(0.65 0.19 60 / 8%)",
                  }}
                >
                  <Bot
                    className="w-3 h-3"
                    style={{ color: "var(--v2-amber-400)" }}
                  />
                </div>
                <div
                  className="dcl-assistant-bubble px-4 py-3 rounded-2xl flex items-center gap-3"
                  style={{
                    border: "1px solid oklch(1 0 0 / 6%)",
                    borderRadius: "4px 18px 18px 18px",
                  }}
                >
                  {/* Bouncing dots */}
                  <div className="flex gap-1">
                    {[0, 1, 2].map((n) => (
                      <div
                        key={n}
                        className="dcl-dot w-1.5 h-1.5 rounded-full"
                        style={{ background: "var(--v2-amber-400)" }}
                      />
                    ))}
                  </div>
                  <span
                    className="text-[11px]"
                    style={{
                      color: "oklch(0.5 0.01 250)",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    Analyzing your data…
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ── Quick Prompts ── */}
          {messages.length <= 1 && !isBusy && (
            <div
              className="dcl-fade px-4 py-3 flex flex-wrap gap-1.5"
              style={{
                borderTop: "1px solid oklch(1 0 0 / 5%)",
              }}
            >
              {QUICK_PROMPTS.map(({ text, icon: Icon }) => (
                <button
                  key={text}
                  onClick={() => handleQuickPrompt(text)}
                  className="dcl-prompt-btn flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-full"
                  style={{
                    border: "1px solid oklch(1 0 0 / 8%)",
                    background: "oklch(1 0 0 / 3%)",
                    color: "oklch(0.65 0.02 250)",
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
          <form
            onSubmit={handleSubmit}
            className="px-4 py-3 flex gap-2.5 items-end"
            style={{
              borderTop: "1px solid oklch(1 0 0 / 5%)",
              background: "oklch(0.1 0.005 250 / 60%)",
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? "Listening…" : "Ask about your productivity…"}
              className="dcl-input flex-1 min-h-[40px] max-h-[80px] resize-none rounded-xl px-3.5 py-2.5 text-[13px]"
              style={{
                background: "oklch(1 0 0 / 4%)",
                border: isListening ? "1px solid var(--v2-amber-400)" : "1px solid oklch(1 0 0 / 8%)",
                color: "oklch(0.9 0.01 250)",
                fontFamily: "var(--font-body)",
                outline: "none",
                boxShadow: isListening ? "0 0 15px oklch(0.65 0.19 60 / 15%)" : "none",
                transition: "border-color 0.2s ease, box-shadow 0.2s ease",
              }}
              rows={1}
            />
            {supported && (
              <button
                type="button"
                onClick={isListening ? stopListening : startListening}
                className="dcl-send-btn h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: isListening
                    ? "oklch(0.65 0.19 60 / 15%)"
                    : "oklch(1 0 0 / 5%)",
                  border: isListening
                    ? "1px solid var(--v2-amber-400)"
                    : "1px solid transparent",
                  color: isListening
                    ? "var(--v2-amber-300)"
                    : "oklch(0.5 0.01 250)",
                  transition: "all 0.2s ease"
                }}
              >
                {isListening ? (
                  <Square className="w-4 h-4 fill-current animate-pulse" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </button>
            )}
            <button
              type="submit"
              disabled={!input.trim() || isBusy}
              className="dcl-send-btn h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: input.trim() && !isBusy
                  ? "linear-gradient(135deg, oklch(0.68 0.19 60), oklch(0.56 0.18 55))"
                  : "oklch(1 0 0 / 5%)",
                border: "none",
                color: input.trim() && !isBusy
                  ? "oklch(0.13 0.01 60)"
                  : "oklch(0.35 0.01 250)",
              }}
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
