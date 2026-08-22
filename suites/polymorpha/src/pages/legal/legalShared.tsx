import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

export const SECTIONS = [
  { id: "terms", label: "Terms of Service" },
  { id: "privacy", label: "Privacy Policy" },
  { id: "cookies", label: "Cookie Policy" },
  { id: "aup", label: "Acceptable Use" },
  { id: "refunds", label: "Refunds & Cancellation" },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];

export function goBackOrFallback(
  navigate: ReturnType<typeof useNavigate>,
  fallback: string,
): void {
  if (typeof window !== "undefined" && window.history.length > 1) {
    navigate(-1);
    return;
  }
  navigate(fallback, { replace: true });
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="legal-section-title">{children}</h2>;
}

export function H3({ children }: { children: ReactNode }) {
  return <h3 className="legal-subsection-title">{children}</h3>;
}

export function P({ children }: { children: ReactNode }) {
  return <p className="legal-paragraph">{children}</p>;
}

export function UL({ children }: { children: ReactNode }) {
  return <ul className="legal-list">{children}</ul>;
}

export function LI({ children }: { children: ReactNode }) {
  return <li className="legal-list-item">{children}</li>;
}
