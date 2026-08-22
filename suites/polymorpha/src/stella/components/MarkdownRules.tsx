import type { Components } from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  dracula,
  oneLight,
} from "react-syntax-highlighter/dist/cjs/styles/prism";
import { useTheme } from "next-themes";

export const stellaMarkdownComponents: Components = {
  h1: ({ node, ...props }) => (
    <h1
      style={{
        fontSize: "15.5px",
        fontWeight: 700,
        marginTop: "16px",
        marginBottom: "8px",
        color: "#f4f5ff",
        lineHeight: 1.32,
        letterSpacing: "-0.015em",
        paddingBottom: "6px",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
      }}
      {...props}
    />
  ),
  h2: ({ node, ...props }) => (
    <h2
      style={{
        fontSize: "14.5px",
        fontWeight: 700,
        marginTop: "16px",
        marginBottom: "8px",
        color: "#f4f5ff",
        lineHeight: 1.32,
        letterSpacing: "-0.015em",
      }}
      {...props}
    />
  ),
  h3: ({ node, ...props }) => (
    <h3
      style={{
        fontSize: "13.8px",
        fontWeight: 700,
        marginTop: "16px",
        marginBottom: "8px",
        color: "#eef0ff",
        lineHeight: 1.32,
      }}
      {...props}
    />
  ),
  p: ({ node, ...props }) => (
    <p
      style={{
        marginTop: 0,
        marginBottom: "10px",
        lineHeight: 1.68,
        color: "#e6e9f5",
        fontSize: "14px",
      }}
      {...props}
    />
  ),
  a: ({ node, ...props }) => (
    <a
      style={{
        color: "#9bb4ff",
        textDecoration: "underline",
        textUnderlineOffset: "3px",
        textDecorationColor: "rgba(155,180,255,0.4)",
        fontWeight: 500,
      }}
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  ul: ({ node, ...props }) => (
    <ul
      style={{
        paddingLeft: "18px",
        listStyleType: "disc",
        marginBottom: "10px",
        marginTop: "6px",
      }}
      {...props}
    />
  ),
  ol: ({ node, ...props }) => (
    <ol
      style={{
        paddingLeft: "18px",
        listStyleType: "decimal",
        marginBottom: "10px",
        marginTop: "6px",
      }}
      {...props}
    />
  ),
  li: ({ node, ...props }) => (
    <li
      style={{
        marginBottom: "6px",
        lineHeight: 1.6,
        paddingLeft: "2px",
        color: "#e6e9f5",
      }}
      {...props}
    />
  ),
  blockquote: ({ node, ...props }) => (
    <blockquote
      style={{
        borderLeft: "3px solid #7c86ff",
        padding: "9px 14px",
        color: "#c6caea",
        fontStyle: "italic",
        margin: "10px 0",
        background: "rgba(99,102,241,0.1)",
        borderRadius: "0 10px 10px 0",
        lineHeight: 1.55,
        fontSize: "13.5px",
      }}
      {...props}
    />
  ),
  table: ({ node, ...props }) => (
    <div
      style={{
        overflowX: "auto",
        margin: "12px 0",
        borderRadius: "10px",
        border: "1px solid rgba(255,255,255,0.08)",
        background: "#2f2f45",
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "separate",
          borderSpacing: 0,
          fontSize: "13px",
          background: "#2f2f45",
        }}
        {...props}
      />
    </div>
  ),
  th: ({ node, ...props }) => (
    <th
      style={{
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        borderRight: "1px solid rgba(255,255,255,0.05)",
        padding: "8px 11px",
        backgroundColor: "#353551",
        fontWeight: 650,
        textAlign: "left",
        fontSize: "11.5px",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        color: "#d6d8f0",
        whiteSpace: "nowrap",
      }}
      {...props}
    />
  ),
  td: ({ node, ...props }) => (
    <td
      style={{
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        borderRight: "1px solid rgba(255,255,255,0.05)",
        padding: "8px 11px",
        color: "#e0e3f2",
        fontSize: "13px",
        lineHeight: 1.45,
      }}
      {...props}
    />
  ),
  code(props) {
    const { children, className, node, ref, ...rest } = props;
    const match = /language-(\w+)/.exec(className || "");

    // Attempt to read current theme, default to dark if not mounted
    let isDark = true;
    try {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const { resolvedTheme } = useTheme();
      isDark = resolvedTheme === "dark";
    } catch {
      // fallback
    }

    if (match) {
      return (
        <div
          style={{ borderRadius: "6px", overflow: "hidden", margin: "0.5em 0" }}
        >
          <SyntaxHighlighter
            {...rest}
            PreTag="div"
            children={String(children).replace(/\n$/, "")}
            language={match[1]}
            style={isDark ? dracula : oneLight}
            customStyle={{
              margin: 0,
              padding: "0.75em",
              fontSize: "0.85em",
              backgroundColor: isDark ? undefined : "var(--muted)",
            }}
          />
        </div>
      );
    }

    return (
      <code
        {...rest}
        className={className}
        style={{
          backgroundColor: "#34344a",
          padding: "2px 6px",
          borderRadius: "6px",
          fontSize: "12.6px",
          fontFamily: '"Geist Mono Variable", ui-monospace, monospace',
          color: "#f5c2e7",
          border: "1px solid rgba(255,255,255,0.07)",
          fontWeight: 500,
        }}
      >
        {children}
      </code>
    );
  },
};
