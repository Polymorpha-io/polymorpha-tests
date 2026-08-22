import { useRef, useEffect } from "react";
import TextareaAutosize from "react-textarea-autosize";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  disabled: boolean;
}

export function StellaInput({
  value,
  onChange,
  onSend,
  onKeyDown,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  return (
    <div className="stella-input-row">
      <TextareaAutosize
        ref={inputRef}
        className="stella-input"
        placeholder="Ask Stella anything…"
        minRows={1}
        maxRows={5}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled}
      />
      <button
        className="stella-send-btn"
        onClick={onSend}
        disabled={!value.trim() || disabled}
        aria-label="Send message"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
          <path d="M2.5 2.5l15 7.5-15 7.5V12l10-2-10-2V2.5z" />
        </svg>
      </button>
    </div>
  );
}
