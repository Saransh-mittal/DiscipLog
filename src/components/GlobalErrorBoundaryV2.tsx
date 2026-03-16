"use client";

import React, { ErrorInfo, ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, RotateCcw, Home, Terminal } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  userContext: string;
  isSubmitting: boolean;
  submitted: boolean;
}

export class GlobalErrorBoundaryV2 extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    userContext: "",
    isSubmitting: false,
    submitted: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      userContext: "",
      isSubmitting: false,
      submitted: false,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught Client Exception:", error, errorInfo);
    this.setState({ errorInfo });
    this.logErrorToDatabase(error, errorInfo, "");
  }

  private logErrorToDatabase = async (
    err: Error,
    info: ErrorInfo | null,
    context: string
  ) => {
    try {
      await fetch("/api/errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: "Client-GlobalErrorBoundary",
          errorMessage: err.message,
          stackTrace: info?.componentStack || err.stack,
          userContext: context,
          routePath: window.location.pathname,
        }),
      });
    } catch {
      // Failsafe
    }
  };

  private handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!this.state.error) return;

    this.setState({ isSubmitting: true });
    await this.logErrorToDatabase(
      this.state.error,
      this.state.errorInfo,
      this.state.userContext
    );
    this.setState({ isSubmitting: false, submitted: true });

    setTimeout(() => {
      this.resetErrorState();
    }, 1500);
  };

  private resetErrorState = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      userContext: "",
      submitted: false,
    });
    window.location.href = "/dashboard";
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          className="v2 min-h-screen flex items-center justify-center p-6"
          style={{ background: "var(--v2-obsidian-900)" }}
        >
          <Card
            className="relative max-w-xl w-full overflow-hidden border p-0"
            style={{
              background: "var(--v2-surface)",
              borderColor: "var(--v2-border)",
            }}
          >
            {/* Scanline overlay */}
            <div className="v2-scanline absolute inset-0 pointer-events-none" />

            {/* Top accent — rose for error */}
            <div
              className="h-[2px] w-full"
              style={{
                background:
                  "linear-gradient(90deg, transparent, var(--v2-rose-500), var(--v2-rose-400), transparent)",
              }}
            />

            <div className="relative z-10 p-8 md:p-10">
              {/* Header */}
              <div className="flex items-center gap-3 mb-6">
                <div
                  className="p-2.5 rounded-xl"
                  style={{ background: "oklch(0.60 0.20 18 / 10%)" }}
                >
                  <Terminal
                    className="w-6 h-6"
                    style={{ color: "var(--v2-rose-400)" }}
                  />
                </div>
                <h1
                  className="text-xl font-bold tracking-tight"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Anomaly{" "}
                  <span style={{ color: "var(--v2-rose-400)" }}>Detected</span>
                </h1>
              </div>

              {/* Error message in terminal style */}
              <div
                className="rounded-xl p-4 mb-6 border"
                style={{
                  background: "var(--v2-obsidian-800)",
                  borderColor: "var(--v2-border)",
                  fontFamily: "var(--font-mono, monospace)",
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: "var(--v2-rose-500)" }}
                  />
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: "var(--v2-amber-400)" }}
                  />
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: "var(--v2-sage-400)" }}
                  />
                </div>
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: "var(--v2-rose-400)" }}
                >
                  <span style={{ color: "var(--v2-obsidian-300)" }}>$</span>{" "}
                  {this.state.error?.message || "Unknown error"}
                </p>
              </div>

              <p
                className="text-sm mb-8 leading-relaxed"
                style={{
                  color: "var(--v2-text-secondary)",
                  fontFamily: "var(--font-body)",
                }}
              >
                Our observability systems have been notified. Providing context
                helps us fix it faster.
              </p>

              {this.state.submitted ? (
                <div
                  className="p-5 rounded-xl flex items-center justify-center gap-2 border"
                  style={{
                    background: "oklch(0.62 0.14 155 / 6%)",
                    borderColor: "oklch(0.62 0.14 155 / 20%)",
                    color: "var(--v2-sage-400)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  <RotateCcw className="w-4 h-4 animate-spin" />
                  <span className="text-sm font-bold">
                    Context logged. Resetting...
                  </span>
                </div>
              ) : (
                <form onSubmit={this.handleSubmit}>
                  <label
                    className="text-[10px] font-bold uppercase tracking-[0.15em] mb-3 block"
                    style={{
                      color: "var(--v2-text-muted)",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    What were you trying to do?
                  </label>
                  <Textarea
                    value={this.state.userContext}
                    onChange={(e) =>
                      this.setState({ userContext: e.target.value })
                    }
                    placeholder="E.g., I clicked save after recording a voice log..."
                    className="min-h-[120px] resize-none rounded-xl border mb-4 text-sm"
                    style={{
                      background: "var(--v2-obsidian-700)",
                      borderColor: "var(--v2-border)",
                      color: "var(--v2-text-primary)",
                      fontFamily: "var(--font-body)",
                    }}
                  />
                  <Button
                    type="submit"
                    disabled={
                      this.state.isSubmitting || !this.state.userContext.trim()
                    }
                    className="w-full h-12 rounded-xl font-bold text-sm gap-2 transition-all duration-200 disabled:opacity-40"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--v2-amber-500), var(--v2-amber-600))",
                      color: "var(--v2-obsidian-900)",
                      fontFamily: "var(--font-body)",
                      border: "none",
                    }}
                  >
                    {this.state.isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Submit Context"
                    )}
                  </Button>
                </form>
              )}

              {/* Dev stack trace */}
              {process.env.NODE_ENV === "development" &&
                this.state.error && (
                  <details className="mt-6 pt-5 border-t" style={{ borderColor: "var(--v2-border)" }}>
                    <summary
                      className="text-[10px] font-bold uppercase tracking-[0.15em] cursor-pointer mb-3 transition-colors hover:opacity-80"
                      style={{
                        color: "var(--v2-obsidian-300)",
                        fontFamily: "var(--font-body)",
                      }}
                    >
                      Developer Stack Trace
                    </summary>
                    <pre
                      className="text-xs p-4 rounded-xl overflow-x-auto whitespace-pre-wrap border"
                      style={{
                        background: "var(--v2-obsidian-800)",
                        borderColor: "var(--v2-border)",
                        color: "var(--v2-rose-400)",
                        fontFamily: "var(--font-mono, monospace)",
                      }}
                    >
                      {this.state.error.toString()}
                      {this.state.errorInfo?.componentStack}
                    </pre>
                  </details>
                )}

              {/* Skip button */}
              {!this.state.submitted && (
                <Button
                  onClick={this.resetErrorState}
                  variant="ghost"
                  className="w-full mt-4 h-11 rounded-xl font-semibold text-sm gap-2"
                  style={{
                    color: "var(--v2-text-muted)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  <Home className="w-4 h-4" /> Skip & Return to Dashboard
                </Button>
              )}
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
