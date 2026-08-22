import { useCallback, useState } from "react";
import { useStellaStore } from "./store";
import { StellaToggle } from "./components/StellaToggle";
import { StellaPanel } from "./components/StellaPanel";
import { StellaRagToggle, StellaRagPanel } from "./components/StellaRagPanel";
import "./StellaAI.css";

export function StellaAI() {
  const {
    isOpen,
    messages,
    isStreaming,
    streamingContent,
    toggle,
    close,
    sendMessage,
    clear,
  } = useStellaStore();
  const [input, setInput] = useState("");
  const [ragOpen, setRagOpen] = useState(false);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    await sendMessage(text);
  }, [input, isStreaming, sendMessage]);

  const handleExampleClick = useCallback((prompt: string) => {
    setInput(prompt);
  }, []);

  return (
    <>
      {!isOpen && <StellaToggle onClick={toggle} />}
      {!ragOpen && <StellaRagToggle onClick={() => setRagOpen(true)} />}
      <StellaPanel
        isOpen={isOpen}
        isStreaming={isStreaming}
        messages={messages}
        input={input}
        streamingContent={streamingContent}
        onInputChange={setInput}
        onSend={handleSend}
        onClose={close}
        onClear={clear}
        onExampleClick={handleExampleClick}
      />
      <StellaRagPanel isOpen={ragOpen} onClose={() => setRagOpen(false)} />
    </>
  );
}
