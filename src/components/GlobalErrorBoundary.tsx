"use client";

import React, { ErrorInfo, ReactNode } from "react";
import { Loader2, RefreshCw, ServerCrash, Home } from "lucide-react";

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

export class GlobalErrorBoundary extends React.Component<Props, State> {
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
      submitted: false 
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught Client Exception:", error, errorInfo);
    this.setState({ errorInfo });
    
    // Automatically log severe crashes to the central observability sink even without user context
    this.logErrorToDatabase(error, errorInfo, "");
  }

  private logErrorToDatabase = async (err: Error, info: ErrorInfo | null, context: string) => {
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
      // Failsafe completely silently
    }
  }

  private handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!this.state.error) return;
    
    this.setState({ isSubmitting: true });
    await this.logErrorToDatabase(this.state.error, this.state.errorInfo, this.state.userContext);
    this.setState({ isSubmitting: false, submitted: true });
    
    // Provide a brief delay for UX before automatic cleanup
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
      submitted: false
    });
    // Safely redirect to the dashboard root in case the current route caused the rendering crash
    window.location.href = "/dashboard";
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 selection:bg-rose-500/30">
          <div className="max-w-xl w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-10 shadow-2xl relative overflow-hidden">
            {/* Soft decorative background pulse */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/10 blur-[80px] rounded-full point-events-none" />

            <div className="mb-8 flex items-center gap-4 text-rose-500">
               <div className="p-3 bg-rose-500/10 rounded-xl">
                 <ServerCrash className="w-8 h-8" />
               </div>
               <h1 className="text-2xl font-bold text-white tracking-tight">Anomaly Detected</h1>
            </div>

            <p className="text-zinc-400 mb-8 leading-relaxed">
              We encountered an unhandled exception while rendering this view. Our observability systems have been quietly notified, but providing context helps us fix it faster.
            </p>

            {this.state.submitted ? (
              <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold rounded-2xl flex items-center justify-center mb-8 gap-3">
                 <RefreshCw className="w-5 h-5 animate-spin" />
                 Context logged securely. Resetting application state...
              </div>
            ) : (
              <form onSubmit={this.handleSubmit} className="mb-8">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 block">
                  What were you trying to do?
                </label>
                <textarea
                  value={this.state.userContext}
                  onChange={(e) => this.setState({ userContext: e.target.value })}
                  placeholder="E.g., I clicked the save button after speaking into the microphone..."
                  className="w-full h-32 bg-zinc-950 border border-zinc-800 focus:border-rose-500 text-zinc-300 rounded-2xl p-5 mb-4 focus:ring-1 focus:ring-rose-500 focus:outline-none resize-none transition-all"
                />
                <button
                  type="submit"
                  disabled={this.state.isSubmitting || !this.state.userContext.trim()}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:bg-zinc-800 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-xl shadow-indigo-500/10"
                >
                  {this.state.isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Submit Context"}
                </button>
              </form>
            )}

            {/* Developer Details Block */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
               <details className="mt-8 pt-6 border-t border-white/5 cursors-pointer text-sm">
                 <summary className="text-zinc-500 font-bold uppercase tracking-wider mb-4 hover:text-white transition-colors">Developer Stack Trace</summary>
                 <pre className="bg-zinc-950 text-rose-300 p-4 rounded-lg overflow-x-auto text-xs whitespace-pre-wrap">
                   {this.state.error.toString()}
                   {this.state.errorInfo?.componentStack}
                 </pre>
               </details>
            )}

            {!this.state.submitted && (
              <button
                onClick={this.resetErrorState}
                className="w-full mt-4 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-300 py-4 font-bold rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                <Home className="w-5 h-5" /> Skip & Return to Dashboard
              </button>
            )}
            
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
