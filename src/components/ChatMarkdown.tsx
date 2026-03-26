"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

interface ChatMarkdownProps {
  content: string;
  isStreaming?: boolean;
}

const MD_COMPONENTS: Components = {
  p: ({ children }) => (
    <p style={{ margin: "0 0 0.5em 0" }}>{children}</p>
  ),
  strong: ({ children }) => (
    <strong
      style={{
        color: "oklch(0.95 0.04 70)",
        fontWeight: 600,
      }}
    >
      {children}
    </strong>
  ),
  em: ({ children }) => (
    <em style={{ color: "oklch(0.88 0.03 75)", fontStyle: "italic" }}>
      {children}
    </em>
  ),
  h1: ({ children }) => (
    <h3
      style={{
        fontFamily: "var(--font-display)",
        fontSize: "14px",
        fontWeight: 700,
        color: "var(--v2-amber-300)",
        letterSpacing: "-0.02em",
        margin: "0.8em 0 0.3em 0",
      }}
    >
      {children}
    </h3>
  ),
  h2: ({ children }) => (
    <h4
      style={{
        fontFamily: "var(--font-display)",
        fontSize: "13px",
        fontWeight: 700,
        color: "var(--v2-amber-300)",
        letterSpacing: "-0.01em",
        margin: "0.7em 0 0.25em 0",
      }}
    >
      {children}
    </h4>
  ),
  h3: ({ children }) => (
    <h5
      style={{
        fontFamily: "var(--font-display)",
        fontSize: "12px",
        fontWeight: 600,
        color: "oklch(0.82 0.10 65)",
        margin: "0.6em 0 0.2em 0",
      }}
    >
      {children}
    </h5>
  ),
  ul: ({ children }) => (
    <ul
      style={{
        margin: "0.3em 0 0.5em 0",
        paddingLeft: "1.1em",
        listStyleType: "none",
      }}
    >
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol
      style={{
        margin: "0.3em 0 0.5em 0",
        paddingLeft: "1.3em",
        counterReset: "md-counter",
        listStyleType: "none",
      }}
    >
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => {
    const isOrdered =
      props.node?.position &&
      props.node.position.start.column > 1;
    return (
      <li
        className="dcl-md-li"
        style={{
          position: "relative",
          marginBottom: "0.2em",
          paddingLeft: isOrdered ? "0.2em" : "0.6em",
          lineHeight: 1.6,
        }}
      >
        {!isOrdered && (
          <span
            style={{
              position: "absolute",
              left: "-0.5em",
              color: "var(--v2-amber-500)",
              fontSize: "10px",
              lineHeight: "1.65",
            }}
          >
            ▸
          </span>
        )}
        {children}
      </li>
    );
  },
  code: ({ children, className }) => {
    const isBlock = className?.startsWith("language-");
    if (isBlock) {
      return (
        <code
          style={{
            display: "block",
            background: "oklch(0.10 0.005 250 / 80%)",
            border: "1px solid oklch(1 0 0 / 6%)",
            borderRadius: "8px",
            padding: "0.6em 0.8em",
            fontSize: "11px",
            fontFamily: "'SF Mono', 'Fira Code', monospace",
            color: "oklch(0.82 0.06 65)",
            overflowX: "auto",
            whiteSpace: "pre",
            margin: "0.4em 0",
          }}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        style={{
          background: "oklch(0.65 0.19 60 / 8%)",
          border: "1px solid oklch(0.65 0.19 60 / 12%)",
          borderRadius: "4px",
          padding: "0.1em 0.35em",
          fontSize: "11.5px",
          fontFamily: "'SF Mono', 'Fira Code', monospace",
          color: "oklch(0.82 0.10 65)",
        }}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre style={{ margin: "0.4em 0", overflow: "hidden" }}>{children}</pre>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        color: "var(--v2-amber-400)",
        textDecoration: "none",
        borderBottom: "1px solid oklch(0.65 0.19 60 / 25%)",
        transition: "border-color 0.15s ease",
      }}
    >
      {children}
    </a>
  ),
  hr: () => (
    <hr
      style={{
        border: "none",
        height: "1px",
        background: "oklch(1 0 0 / 8%)",
        margin: "0.6em 0",
      }}
    />
  ),
  blockquote: ({ children }) => (
    <blockquote
      style={{
        borderLeft: "2px solid var(--v2-amber-500)",
        paddingLeft: "0.7em",
        margin: "0.4em 0",
        color: "oklch(0.72 0.02 250)",
        fontStyle: "italic",
      }}
    >
      {children}
    </blockquote>
  ),
};

export default function ChatMarkdown({
  content,
  isStreaming = false,
}: ChatMarkdownProps) {
  if (!content) {
    return null;
  }

  return (
    <div className={`dcl-md-root ${isStreaming ? "dcl-cursor" : ""}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
