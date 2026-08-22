import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { IStellaMessage } from "@/stella/types";
import { stellaMarkdownComponents } from "./MarkdownRules";

interface Props {
  message: IStellaMessage;
}

export function StellaMessage({ message }: Props) {
  return (
    <div className={`stella-msg stella-msg--${message.role}`}>
      {message.role === "assistant" && (
        <div className="stella-msg-label">Stella</div>
      )}
      <div className="stella-msg-bubble">
        {message.role === "assistant" ? (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={stellaMarkdownComponents}
          >
            {message.content}
          </ReactMarkdown>
        ) : (
          message.content
        )}
      </div>
    </div>
  );
}
