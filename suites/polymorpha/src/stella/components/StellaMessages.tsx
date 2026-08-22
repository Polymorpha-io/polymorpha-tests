import { useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { IStellaMessage } from "@/stella/types";
import { EXAMPLE_PROMPTS } from "@/stella/types";
import { StellaMessage } from "./StellaMessage";
import { stellaMarkdownComponents } from "./MarkdownRules";

interface Props {
  messages: IStellaMessage[];
  isStreaming: boolean;
  streamingContent: string;
  onExampleClick: (prompt: string) => void;
  onClear: () => void;
}

export function StellaMessages({
  messages,
  isStreaming,
  streamingContent,
  onExampleClick,
  onClear,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming, streamingContent]);

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="stella-welcome">
        <div className="stella-welcome-icon">✦</div>
        <h3 className="stella-welcome-title">Hi, I'm Stella!</h3>
        <p className="stella-welcome-desc">
          Ask me anything about your data or statistics.
        </p>
        <div className="stella-welcome-chips">
          {EXAMPLE_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              className="stella-chip"
              onClick={() => onExampleClick(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>
        <button className="stella-clear-btn" onClick={onClear}>
          Clear conversation
        </button>
      </div>
    );
  }

  return (
    <div className="stella-messages">
      {messages.map((msg, i) => (
        <StellaMessage key={i} message={msg} />
      ))}
      {isStreaming && (
        <div className="stella-msg stella-msg--assistant">
          <div className="stella-msg-label">Stella</div>
          <div className="stella-msg-bubble">
            {streamingContent ? (
              <>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={stellaMarkdownComponents}
                >
                  {streamingContent}
                </ReactMarkdown>
                <span className="stella-streaming-cursor" aria-hidden="true" />
              </>
            ) : (
              <span className="stella-typing">
                <span className="stella-typing-dot" />
                <span className="stella-typing-dot" />
                <span className="stella-typing-dot" />
              </span>
            )}
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
