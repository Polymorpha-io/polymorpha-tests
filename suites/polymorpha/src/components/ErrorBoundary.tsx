import React from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(
      "[polymorpha] Uncaught render error:",
      error,
      info.componentStack,
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: "3rem",
            textAlign: "center",
            maxWidth: 480,
            margin: "0 auto",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
            Something went wrong
          </h1>
          <p style={{ color: "#888", marginBottom: "1.5rem" }}>
            An unexpected error occurred. Try refreshing the page.
          </p>
          <pre
            style={{
              fontSize: "0.75rem",
              color: "#f87171",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              marginBottom: "1.5rem",
            }}
          >
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "0.5rem 1.5rem",
              borderRadius: 6,
              border: "1px solid #555",
              background: "transparent",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            Reload page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
