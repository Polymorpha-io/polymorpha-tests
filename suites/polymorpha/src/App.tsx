import React, { useCallback, useEffect, useState } from "react";
import {
  Routes,
  Route,
  Link,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { Pipeline } from "./components/Pipeline/Pipeline";

const AboutPage = React.lazy(() =>
  import("./pages/AboutPage").then((m) => ({ default: m.AboutPage })),
);
const LegalPage = React.lazy(() => import("./pages/LegalPage"));
const DictionaryPublicPage = React.lazy(() =>
  import("./pages/DictionaryPublicPage").then((m) => ({
    default: m.DictionaryPublicPage,
  })),
);
const LoginPage = React.lazy(() =>
  import("./pages/LoginPage").then((m) => ({ default: m.LoginPage })),
);
const SignupPage = React.lazy(() =>
  import("./pages/SignupPage").then((m) => ({ default: m.SignupPage })),
);
const ForgotPasswordPage = React.lazy(() =>
  import("./pages/ForgotPasswordPage").then((m) => ({
    default: m.ForgotPasswordPage,
  })),
);
const ProfilePageV2 = React.lazy(() =>
  import("@/pages/profile-v2").then((m) => ({
    default: m.ProfilePageV2,
  })),
);
const WorkspaceListPage = React.lazy(() =>
  import("./pages/WorkspaceListPage").then((m) => ({
    default: m.WorkspaceListPage,
  })),
);
const WorkspaceDetailPage = React.lazy(() =>
  import("./pages/WorkspaceDetailPage").then((m) => ({
    default: m.WorkspaceDetailPage,
  })),
);
import { QuickFind } from "./components/QuickFind/QuickFind";
import { StellaAI } from "./stella";
import {
  createWorkspaceService,
  type WorkspaceSummary,
} from "./lib/WorkspaceService";

import { CartFab } from "./components/CartFab/CartFab";
import { CartNavButton } from "./components/CartFab/CartNavButton";
import { BetaFeedback } from "./components/BetaFeedback";
import { DisclaimerModal, CookieBanner } from "./components/Consent";
import { ErrorBoundary } from "./components/ErrorBoundary";
import {
  readStorageJson,
  readStorageValue,
  writeStorageValue,
} from "./lib/storage";
import { useWorkspaceAutosave } from "./hooks/useWorkspaceAutosave";
import { useNotebookSync } from "./notebook/useNotebookSync";
import { trackPageview } from "./lib/tracking";
import { Toaster } from "@/components/shadcn/sonner";
import { Info, BookOpen, UserRound, Sun, Moon } from "lucide-react";
import { SidebarTrigger } from "@/components/SidebarTrigger";
import { useDataStore } from "./store/useDataStore";
import { useConfigStore } from "./store/useConfigStore";
import { useAuthStore } from "./store/useAuthStore";
import { usePrefsStore, type StatsLevel } from "./store/usePrefsStore";
import { useShallow } from "zustand/react/shallow";
import "./App.css";
import "./lib/shared.css";
import "./components/BetaFeedback.css";

/** Declarative home route: redirects authenticated users (with no active pipeline data) to /workspaces */
function HomeRoute() {
  const homeUser = useAuthStore((s) => s.user);
  const homeAuthInit = useAuthStore((s) => s.initialized);
  const homeRaw = useDataStore((s) => s.raw);
  if (!homeAuthInit)
    return (
      <div className="page-loading" aria-busy="true">
        Loading…
      </div>
    );
  if (homeUser && !homeRaw) return <Navigate to="/workspaces" replace />;
  return <Pipeline />;
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { step, reset, raw, cleaned } = useDataStore(
    useShallow((s) => ({
      step: s.step,
      reset: s.reset,
      raw: s.raw,
      cleaned: s.cleaned,
    })),
  );
  const [showHomeConfirm, setShowHomeConfirm] = React.useState(false);
  const [showStatsLevelPrompt, setShowStatsLevelPrompt] = React.useState(false);
  const hasShownStatsLevelRef = React.useRef(false);
  const [showQuickFind, setShowQuickFind] = React.useState(false);
  const [quickFindWorkspaces, setQuickFindWorkspaces] = React.useState<
    WorkspaceSummary[]
  >([]);
  const { settings } = useConfigStore(
    useShallow((s) => ({
      settings: s.settings,
    })),
  );
  const user = useAuthStore((s) => s.user);
  const workspaceId = useDataStore((s) => s.workspaceId);
  const service = React.useMemo(
    () => (user ? createWorkspaceService(user.uid) : null),
    [user?.uid],
  );
  useWorkspaceAutosave(workspaceId ?? undefined, service);
  useNotebookSync(workspaceId);
  // Load notebook from Firebase on workspace open (per-workspace canonical, G24 thin adapter)
  React.useEffect(() => {
    if (!workspaceId || !service) return;
    import("@/notebook/NotebookStorage")
      .then(({ loadNotebook }) =>
        loadNotebook(
          service as unknown as import("@/lib/WorkspaceServiceTypes").WorkspaceHost,
          workspaceId,
        ),
      )
      .then(async (nb) => {
        if (!nb) return;
        const { notebookRepository } =
          await import("@/notebook/NotebookRepository");
        const existing = await notebookRepository.getByWorkspace(workspaceId);
        if (!existing || (existing.updatedAt ?? 0) < (nb.updatedAt ?? 0)) {
          await notebookRepository.put(nb);
          const { knowledgeService } =
            await import("@/knowledge/KnowledgeService");
          await knowledgeService.indexNotebook(nb).catch(() => {});
        }
      })
      .catch(() => {});
  }, [workspaceId, service]);
  const homeConfirmCloseButtonRef = React.useRef<HTMLButtonElement | null>(
    null,
  );
  const statsPromptSkipButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const statsPromptDialogRef = React.useRef<HTMLDivElement | null>(null);
  const homeConfirmDialogRef = React.useRef<HTMLDivElement | null>(null);

  const hasWorkInProgress = Boolean(raw || cleaned || step !== "upload");

  const handleLogoClick = React.useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (location.pathname === "/about") return;
      if (!hasWorkInProgress) return;
      if (location.pathname === "/" && step === "upload" && !raw && !cleaned)
        return;
      e.preventDefault();
      setShowHomeConfirm(true);
    },
    [hasWorkInProgress, location.pathname, step, raw, cleaned],
  );

  const handleConfirmGoHome = React.useCallback(() => {
    reset();
    setShowHomeConfirm(false);
    navigate("/");
  }, [navigate, reset]);

  // Show stats level prompt once when user first lands on preview after upload
  React.useEffect(() => {
    if (step === "preview" && raw && !hasShownStatsLevelRef.current) {
      const storedPrefs = readStorageJson<{ statsLevel?: string } | null>(
        "polymorpha-user-prefs",
        null,
      );
      if (!storedPrefs?.statsLevel) {
        setShowStatsLevelPrompt(true);
      }
      hasShownStatsLevelRef.current = true;
    }
  }, [step, raw]);

  React.useEffect(() => {
    trackPageview();
  }, [location.pathname]);

  // Ctrl+K / Cmd+K Quick Find listener
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setShowQuickFind((v) => !v);
        // Load workspaces on open
        if (!showQuickFind && user) {
          service
            ?.listWorkspaces()
            .then(setQuickFindWorkspaces)
            .catch(() => {});
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showQuickFind, user]);

  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = readStorageValue("polymorpha-theme");
    return saved === "dark" ? "dark" : "light";
  });

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      writeStorageValue("polymorpha-theme", next);
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div className="app">
      <Toaster position="top-right" visibleToasts={4} />
      <ErrorBoundary>
        <header className="app-header">
          <div className="header-left">
            <SidebarTrigger />
            <Link
              to={user ? "/workspaces" : "/"}
              className="logo-link"
              onClick={handleLogoClick}
            >
              <svg
                className="logo-blob"
                viewBox="12 16 76 68"
                aria-hidden="true"
              >
                <defs>
                  <filter id="logoGlow">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <radialGradient id="logoBlobGrad" cx="35%" cy="35%">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.85" />
                    <stop offset="50%" stopColor="#6366f1" stopOpacity="0.7" />
                    <stop
                      offset="100%"
                      stopColor="#8b5cf6"
                      stopOpacity="0.75"
                    />
                  </radialGradient>
                  <radialGradient id="logoBlobGrad2" cx="65%" cy="60%">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0.3" />
                  </radialGradient>
                </defs>
                <path
                  d="M50 18 C68 18 82 28 84 44 C86 60 78 74 62 80 C46 86 30 78 22 64 C14 50 20 32 36 22 C42 18 46 18 50 18Z"
                  fill="url(#logoBlobGrad)"
                  opacity="0.35"
                  filter="url(#logoGlow)"
                />
                <path
                  d="M50 22 C66 22 78 30 80 44 C82 58 75 70 61 76 C47 82 33 75 26 63 C19 51 24 35 38 26 C44 22 47 22 50 22Z"
                  fill="url(#logoBlobGrad)"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeOpacity="0.3"
                />
                <ellipse
                  cx="58"
                  cy="56"
                  rx="22"
                  ry="20"
                  fill="url(#logoBlobGrad2)"
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
                <ellipse
                  cx="56"
                  cy="48"
                  rx="8"
                  ry="6"
                  fill="white"
                  opacity="0.3"
                />
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
              <h1 className="logo">Polymorpha</h1>
            </Link>
            <BetaFeedback />
          </div>
          <div className="header-right">
            <Link
              to="/about"
              className={`header-nav-btn${location.pathname === "/about" ? " nav-active" : ""}`}
              title="About"
              aria-label="About"
            >
              <Info size={16} color="#6366f1" />
            </Link>

            <Link
              to="/dictionary"
              className={`header-nav-btn${location.pathname.startsWith("/dictionary") ? " nav-active" : ""}`}
              title="Dictionary"
              aria-label="Open dictionary"
            >
              <BookOpen size={16} color="#f59e0b" />
            </Link>

            <button
              className="header-nav-btn"
              onClick={handleToggleTheme}
              title={
                theme === "light"
                  ? "Switch to dark theme"
                  : "Switch to light theme"
              }
              aria-label={
                theme === "light"
                  ? "Switch to dark theme"
                  : "Switch to light theme"
              }
            >
              {theme === "light" ? (
                <Moon size={16} color="#818cf8" />
              ) : (
                <Sun size={16} color="#f59e0b" />
              )}
            </button>

            {settings.features.showAuth &&
              (user ? (
                <div className="header-avatar-wrap">
                  <Link
                    to="/profile-v2"
                    className="header-avatar"
                    title={user.displayName ?? user.email ?? "Profile"}
                  >
                    {user.photoURL &&
                    (user.photoURL.includes("firebasestorage.googleapis.com") ||
                      user.photoURL.includes("firebasestorage.app")) ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName ?? user.email ?? "User avatar"}
                        className="header-avatar-img"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <span className="header-avatar-fallback">
                        {(user.displayName ??
                          user.email ??
                          "?")[0].toUpperCase()}
                      </span>
                    )}
                  </Link>
                </div>
              ) : (
                <Link
                  to="/login"
                  className={`header-nav-btn${location.pathname === "/login" ? " nav-active" : ""}`}
                  title="Sign in to save your work"
                  aria-label="Sign in"
                >
                  <UserRound size={16} color="#10b981" />
                </Link>
              ))}

            <CartNavButton />
          </div>
        </header>
      </ErrorBoundary>

      <ErrorBoundary>
        <React.Suspense
          fallback={
            <div className="page-loading" aria-busy="true">
              Loading page...
            </div>
          }
        >
          <Routes>
            <Route path="/about" element={<AboutPage />} />
            <Route path="/legal" element={<LegalPage />} />
            <Route path="/dictionary" element={<DictionaryPublicPage />} />
            <Route
              path="/dictionary/:category"
              element={<DictionaryPublicPage />}
            />
            <Route
              path="/dictionary/:category/:termId"
              element={<DictionaryPublicPage />}
            />
            {settings.features.showAuth && (
              <Route path="/login" element={<LoginPage />} />
            )}
            {settings.features.showAuth && (
              <Route path="/signup" element={<SignupPage />} />
            )}
            {settings.features.showAuth && (
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            )}
            {settings.features.showAuth && (
              <Route path="/profile" element={<ProfilePageV2 />} />
            )}
            {settings.features.showAuth && (
              <Route path="/profile-v2" element={<ProfilePageV2 />} />
            )}
            {settings.features.showAuth && (
              <Route path="/workspaces" element={<WorkspaceListPage />} />
            )}
            {settings.features.showAuth && (
              <Route
                path="/workspaces/:workspaceId"
                element={<WorkspaceDetailPage />}
              />
            )}

            <Route path="/" element={<HomeRoute />} />
            <Route
              path="/404"
              element={
                <div className="page-loading">
                  404 — Page not found. <Link to="/">Go home</Link>
                </div>
              }
            />
            <Route path="*" element={<Pipeline />} />
          </Routes>
        </React.Suspense>
      </ErrorBoundary>

      <ErrorBoundary>
        {showHomeConfirm && (
          <div
            className="data-viewer-backdrop"
            onClick={() => setShowHomeConfirm(false)}
          >
            <div
              ref={homeConfirmDialogRef}
              className="data-viewer-modal about-modal"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Confirm return to home"
              tabIndex={-1}
            >
              <div className="data-viewer-head">
                <h3>Leave current progress?</h3>
                <button
                  ref={homeConfirmCloseButtonRef}
                  className="modal-close-icon"
                  aria-label="Close confirmation"
                  onClick={() => setShowHomeConfirm(false)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path
                      d="M6 6l12 12M18 6 6 18"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
              <p className="clean-hint-line">
                You have ongoing work in this session. Going back home will
                clear the current workflow state.
              </p>
              <div className="home-confirm-actions">
                <button
                  className="btn-secondary btn-sm"
                  onClick={() => setShowHomeConfirm(false)}
                >
                  Stay here
                </button>
                <button
                  className="btn-confirm btn-sm"
                  onClick={handleConfirmGoHome}
                >
                  Go to home
                </button>
              </div>
            </div>
          </div>
        )}

        {showStatsLevelPrompt && (
          <div
            className="data-viewer-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="Select statistics level"
          >
            <div
              ref={statsPromptDialogRef}
              className="stats-level-modal"
              tabIndex={-1}
            >
              <h3>What's your statistics background?</h3>
              <p>
                This helps us recommend the right tests and show results at the
                right level of detail.
              </p>
              <div className="stats-level-options">
                {(
                  [
                    {
                      value: "basic" as StatsLevel,
                      label: "Basic",
                      desc: "I know means, medians, and simple correlations.",
                    },
                    {
                      value: "advanced" as StatsLevel,
                      label: "Advanced",
                      desc: "I understand hypothesis testing, ANOVA, and non-parametric methods.",
                    },
                    {
                      value: "professional" as StatsLevel,
                      label: "Professional",
                      desc: "I work with regression diagnostics, model selection, and advanced inference.",
                    },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    className="stats-level-option"
                    onClick={() => {
                      usePrefsStore.getState().setStatsLevel(opt.value);
                      setShowStatsLevelPrompt(false);
                    }}
                  >
                    <strong>{opt.label}</strong>
                    <span>{opt.desc}</span>
                  </button>
                ))}
              </div>
              <button
                ref={statsPromptSkipButtonRef}
                className="stats-level-skip"
                onClick={() => setShowStatsLevelPrompt(false)}
              >
                Skip for now
              </button>
            </div>
          </div>
        )}

        <CartFab />
        <DisclaimerModal />
        <CookieBanner />

        {showQuickFind && (
          <QuickFind
            open={showQuickFind}
            onClose={() => setShowQuickFind(false)}
            workspaces={quickFindWorkspaces}
            onSelectWorkspace={(id) => {
              setShowQuickFind(false);
              navigate(`/workspaces/${id}`);
            }}
          />
        )}

        <StellaAI />

        <footer className="app-footer">
          <div className="footer-bottom">
            <span>&copy; 2026 Polymorpha. All rights reserved.</span>
          </div>
        </footer>
      </ErrorBoundary>
    </div>
  );
}

export default App;
