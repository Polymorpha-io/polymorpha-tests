interface Props {
  onClick: () => void;
}

export function StellaToggle({ onClick }: Props) {
  return (
    <button
      className="stella-toggle"
      onClick={onClick}
      aria-label="Open Stella AI"
    >
      <span className="stella-toggle-icon">✦</span>
      <span className="stella-toggle-label">Stella</span>
    </button>
  );
}
