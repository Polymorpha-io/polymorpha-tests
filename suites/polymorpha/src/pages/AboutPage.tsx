import React from "react";
import { Link } from "react-router-dom";
import { useConfigStore } from "../store/useConfigStore";
import { useDataStore } from "../store/useDataStore";
import { AboutHero } from "./AboutHero";
import "./AboutPage.css";
import "./css/about-dark.css";
import "./css/about-orbit.css";
import "./css/about-lava.css";
import "./css/about-secondary.css";
import "./css/about-tiny.css";
import "./css/about-scatter.css";
import "./css/about-scroll.css";
import "./css/about-wrappers.css";
import "./css/about-roadmap.css";
import "./css/about-team.css";
import "./css/about-contact.css";

const TEAM = [
  {
    name: "Shawn",
    role: "Founder",
    photo: "/shawn.png",
    bio: "I have always loved analytics. I built Polymorpha to be the tool I needed and envisioned in my younger years. From initial idea to its current implementation, this project has gone through trials and tribulations and is now in its third year of development.",
  },
  {
    name: "Ymman",
    role: "Business Analyst & Marketing Strategist",
    photo: "/ymman.jpg",
    bio: "I have always believed in combining technology with strategy and purpose. With a background in Computer Science and business analysis, I focus on bridging innovation with real-world impact. Together with Shawn, a longtime friend and co-founder, we are building tools that empower people through AI, not to replace human potential, but to amplify and simplify the way we move forward.",
  },
  {
    name: "Glen",
    role: "Developer",
    photo: "/glen.png",
    bio: "I approach software as a craft, not just code on a screen. AI accelerates the build, but the architecture, the decisions, and the polish are still mine. I'm the engineer on this team — I turn ideas into working systems, and make sure what ships is something people actually want to use.",
  },
];

const GRID_SECTIONS = [
  {
    index: "01",
    title: "One workspace, entire pipeline",
    content: [
      "Upload a CSV. Clean it, run statistical tests, visualize results, and export a formatted report. No tab switching, no installs. Polymorpha handles the full workflow in one place.",
    ],
  },
  {
    index: "02",
    title: "Why it exists",
    content: [
      "Researchers juggle a dozen browser tabs to clean, test, chart, and export one dataset. No single tool covers the whole pipeline without heavy setup or paid desktop software.",
      "Polymorpha closes that gap. Descriptive stats, inferential tests, charts, data cleaning, and a built-in statistical dictionary, all accessible the moment you upload your data.",
    ],
  },
  {
    index: "03",
    title: "Actively maintained",
    content: [
      "New features ship regularly. Current focus: AI-assisted analysis, expanded test coverage, and performance at scale.",
    ],
  },
];

const ROADMAP = [
  {
    id: "01",
    title: "Stella AI",
    note: "AI-guided analysis and interpretation",
    color: "#3b82f6",
  },
  {
    id: "02",
    title: "Machine Learning pipelines",
    note: "Model-ready workflows from cleaned data",
    color: "#6366f1",
  },
  {
    id: "03",
    title: "Saved workspaces",
    note: "Pick up where you left off across sessions",
    color: "#8b5cf6",
  },
];

export function AboutPage() {
  const settings = useConfigStore((s) => s.settings);
  const raw = useDataStore((s) => s.raw);
  const cleaned = useDataStore((s) => s.cleaned);
  const step = useDataStore((s) => s.step);
  const hasWorkInProgress = Boolean(raw || cleaned || step !== "upload");

  React.useEffect(() => {
    const els = document.querySelectorAll(".animate-section");
    if (!els.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <main className="about-page-shell">
      <AboutHero />
      <section className="about-page-panel">
        <header className="about-page-head">
          {hasWorkInProgress && (
            <Link to="/" className="back-btn">
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="10 3 5 8 10 13" />
              </svg>
              Back to Work
            </Link>
          )}
          <h2>{settings.about.title}</h2>
          <p>
            Raw datasets into readable, dependable statistical outputs in one
            workflow.
          </p>
        </header>

        <section id="mission" className="about-mission animate-section">
          <h2>Everything in one place</h2>
          <div className="about-page-intro-grid">
            {GRID_SECTIONS.map((s, i) => (
              <section
                className="about-page-section animate-stagger"
                key={s.index}
                style={{ "--i": i } as React.CSSProperties}
              >
                <span className="about-page-card-index">{s.index}</span>
                <h3>{s.title}</h3>
                {s.content.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </section>
            ))}
          </div>
        </section>

        <section id="roadmap" className="about-roadmap animate-section">
          <h2>Coming next</h2>
          <ol
            className="about-page-timeline"
            aria-label="Upcoming roadmap items"
          >
            {ROADMAP.map((item, i) => (
              <li
                className="about-page-timeline-item animate-stagger"
                key={item.title}
                style={
                  {
                    "--card-accent": item.color,
                    borderLeftColor: item.color,
                    boxShadow: `-4px 0 24px ${item.color}66, 0 0 40px ${item.color}22, -8px 0 32px ${item.color}11`,
                    "--i": i,
                  } as React.CSSProperties
                }
              >
                <span className="about-page-timeline-title">{item.title}</span>
                <span className="about-page-timeline-note">{item.note}</span>
              </li>
            ))}
          </ol>
        </section>

        <section
          id="team"
          className="about-team-section animate-section"
          style={{ position: "relative" }}
        >
          {/* Static decorative blob behind the dev card — matches favicon design */}
          <svg
            viewBox="14 14 72 72"
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "-30px",
              right: "10px",
              width: "100px",
              height: "100px",
              opacity: 1,
              pointerEvents: "none",
              zIndex: 2,
            }}
          >
            <defs>
              <filter id="devGlow">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <radialGradient id="devBlobGrad" cx="35%" cy="35%">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.85" />
                <stop offset="50%" stopColor="#6366f1" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.75" />
              </radialGradient>
              <radialGradient id="devBlobGrad2" cx="65%" cy="60%">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0.3" />
              </radialGradient>
            </defs>
            <path
              d="M50 18 C68 18 82 28 84 44 C86 60 78 74 62 80 C46 86 30 78 22 64 C14 50 20 32 36 22 C42 18 46 18 50 18Z"
              fill="url(#devBlobGrad)"
              opacity="0.35"
              filter="url(#devGlow)"
            />
            <path
              d="M50 22 C66 22 78 30 80 44 C82 58 75 70 61 76 C47 82 33 75 26 63 C19 51 24 35 38 26 C44 22 47 22 50 22Z"
              fill="url(#devBlobGrad)"
              stroke="white"
              strokeWidth="1.5"
              strokeOpacity="0.3"
            />
            <ellipse
              cx="58"
              cy="56"
              rx="22"
              ry="20"
              fill="url(#devBlobGrad2)"
            />
            <path
              d="M50 30 C62 30 70 36 72 46 C74 56 68 64 58 68 C48 72 38 67 34 58 C30 49 34 38 42 32 C46 30 48 30 50 30Z"
              fill="white"
              opacity="0.18"
            />
            <ellipse
              cx="42"
              cy="38"
              rx="14"
              ry="10"
              fill="white"
              opacity="0.5"
            />
            <ellipse cx="56" cy="48" rx="8" ry="6" fill="white" opacity="0.3" />
            <circle cx="38" cy="44" r="2.5" fill="white" opacity="0.95" />
            <circle cx="55" cy="36" r="2" fill="white" opacity="0.9" />
            <circle cx="62" cy="54" r="2.2" fill="white" opacity="0.85" />
            <circle cx="44" cy="62" r="1.8" fill="white" opacity="0.8" />
            <circle cx="50" cy="50" r="3" fill="white" opacity="0.95" />
            <line
              x1="38"
              y1="44"
              x2="55"
              y2="36"
              stroke="white"
              strokeWidth="0.6"
              strokeOpacity="0.5"
              strokeDasharray="2 2"
            />
            <line
              x1="55"
              y1="36"
              x2="62"
              y2="54"
              stroke="white"
              strokeWidth="0.6"
              strokeOpacity="0.45"
              strokeDasharray="2 2"
            />
            <line
              x1="50"
              y1="50"
              x2="44"
              y2="62"
              stroke="white"
              strokeWidth="0.6"
              strokeOpacity="0.5"
              strokeDasharray="2 2"
            />
            <line
              x1="50"
              y1="50"
              x2="38"
              y2="44"
              stroke="white"
              strokeWidth="0.6"
              strokeOpacity="0.45"
              strokeDasharray="2 2"
            />
          </svg>
          <h2 style={{ position: "relative", zIndex: 1 }}>Built by</h2>
          {TEAM.map((m, i) => (
            <div
              className="about-team-member animate-stagger"
              key={m.name}
              style={{ "--i": i } as React.CSSProperties}
            >
              <div
                className="about-team-card"
                style={{ position: "relative", zIndex: 1 }}
              >
                <img src={m.photo} alt={m.name} className="about-team-photo" />
                <div>
                  <p className="about-team-name">{m.name}</p>
                  <p className="about-team-role">{m.role}</p>
                </div>
              </div>
              <p>{m.bio}</p>
            </div>
          ))}
        </section>

        <section id="contact" className="about-contact animate-section">
          <h2>Contact</h2>
          <p className="about-page-contact-note">
            Found a bug, have feedback, or want to collaborate? Reach out
            anytime.
          </p>
          <p className="about-page-links about-page-contact-links">
            <a
              href={settings.about.linkedinUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="LinkedIn profile"
              className="about-page-link-with-icon"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M4.98 3.5A2.48 2.48 0 1 0 5 8.46 2.48 2.48 0 0 0 4.98 3.5ZM3 9h4v12H3zM9 9h3.8v1.71h.05c.53-1 1.84-2.06 3.79-2.06 4.05 0 4.8 2.66 4.8 6.12V21h-4v-5.47c0-1.3-.02-2.98-1.81-2.98-1.82 0-2.1 1.42-2.1 2.88V21H9z" />
              </svg>
              <span>LinkedIn</span>
            </a>
            <a href="mailto:shawnmichaelfm@polymorpha.com">
              shawnmichaelfm@polymorpha.com
            </a>
          </p>
        </section>
      </section>
    </main>
  );
}
