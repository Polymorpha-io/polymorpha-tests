import React from "react";
import { readStorageValue, writeStorageValue } from "@/lib/storage";
import "./Consent.css";

const DISCLAIMER_KEY = "polymorpha-disclaimer-accepted";
const COOKIE_KEY = "polymorpha-cookie-consent";

/* First-Visit Disclaimer Modal */

export function DisclaimerModal() {
  const [visible, setVisible] = React.useState(() => {
    return readStorageValue(DISCLAIMER_KEY) !== "1";
  });

  if (!visible) return null;

  const handleAccept = () => {
    writeStorageValue(DISCLAIMER_KEY, "1");
    setVisible(false);
  };

  return (
    <div
      className="disclaimer-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="disclaimer-title"
    >
      <div className="disclaimer-modal">
        <h2 id="disclaimer-title">Before you begin</h2>
        <ul className="disclaimer-list">
          <li>
            All statistical analysis runs locally in your browser. Your data is
            not sent to any server unless you explicitly enable cloud storage.
          </li>
          <li>
            Results are for informational and educational purposes only — not
            professional, medical, or legal advice.
          </li>
          <li>
            Do not upload regulated, confidential, or personally identifiable
            data without proper authorisation.
          </li>
          <li>
            Polymorpha is in beta. Features may change, and uptime is not
            guaranteed.
          </li>
        </ul>
        <p className="disclaimer-legal">
          By continuing, you agree to our{" "}
          <a href="/legal#terms" target="_blank" rel="noopener">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="/legal#privacy" target="_blank" rel="noopener">
            Privacy Policy
          </a>
          .
        </p>
        <button
          className="btn-primary disclaimer-accept"
          onClick={handleAccept}
        >
          I understand, continue
        </button>
      </div>
    </div>
  );
}

/* Cookie Consent Banner */

export function CookieBanner() {
  const [visible, setVisible] = React.useState(() => {
    return (
      readStorageValue(DISCLAIMER_KEY) === "1" &&
      readStorageValue(COOKIE_KEY) === null
    );
  });

  if (!visible) return null;

  const handleAccept = () => {
    writeStorageValue(COOKIE_KEY, "all");
    setVisible(false);
  };

  const handleEssentialOnly = () => {
    writeStorageValue(COOKIE_KEY, "essential");
    setVisible(false);
  };

  return (
    <div className="cookie-banner" role="region" aria-label="Cookie consent">
      <p className="cookie-banner-text">
        This site uses essential cookies for authentication and security.{" "}
        <a href="/legal#cookies">Learn more</a>
      </p>
      <div className="cookie-banner-actions">
        <button className="btn-secondary btn-sm" onClick={handleEssentialOnly}>
          Essential only
        </button>
        <button className="btn-primary btn-sm" onClick={handleAccept}>
          Accept all
        </button>
      </div>
    </div>
  );
}
