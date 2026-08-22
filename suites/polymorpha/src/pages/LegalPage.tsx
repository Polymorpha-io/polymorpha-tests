import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CONTENT_MAP } from "./legal/legalContent";
import { H2, SECTIONS, goBackOrFallback } from "./legal/legalShared";
import type { SectionId } from "./legal/legalShared";
import "./LegalPage.css";

export default function LegalPage() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<SectionId>("terms");

  const ContentComponent = CONTENT_MAP[activeSection];

  return (
    <div className="legal-page">
      <button
        className="back-btn"
        onClick={() => goBackOrFallback(navigate, "/")}
      >
        ← Back
      </button>

      <div className="legal-header">
        <h1 className="legal-title">Policies & Legal</h1>
        <p className="legal-meta">Last updated: 24 May 2026</p>
      </div>

      <div className="legal-layout">
        {/* Sidebar Navigation */}
        <nav className="legal-sidebar">
          <div className="legal-sidebar-label">Sections</div>
          <div className="legal-sidebar-nav">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                className={`legal-nav-item ${activeSection === section.id ? "active" : ""}`}
                onClick={() => setActiveSection(section.id)}
              >
                {section.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Main Content */}
        <div className="legal-content">
          <div className="legal-section">
            <H2>{SECTIONS.find((s) => s.id === activeSection)?.label}</H2>
            <ContentComponent />
          </div>
        </div>
      </div>
    </div>
  );
}
