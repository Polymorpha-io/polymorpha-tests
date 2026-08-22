import { useState, useRef } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { getFirebaseDb } from "@/config/firebase";
import { getFirebaseStorage } from "@/config/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Dialog, DialogContent } from "@/components/shadcn/dialog";

export function BetaFeedback() {
  const SUPPORT_EMAIL = "support@polymorpha.io";
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"bug" | "feature" | "general">("bug");
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [steps, setSteps] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const user = useAuthStore((s) => s.user);

  const originEmail = (user?.email ?? email).trim();
  const canSubmit = name.trim() && message.trim();

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSending(true);
    setSubmitError("");
    let fileUrl: string | null = null;

    // Best-effort upload; do not block submission confirmation.
    if (file) {
      try {
        const storage = getFirebaseStorage();
        if (storage) {
          const path = `feedback/${Date.now()}_${file.name}`;
          const storageRef = ref(storage, path);
          await uploadBytes(storageRef, file);
          fileUrl = await getDownloadURL(storageRef);
        }
      } catch {
        // Continue without attachment URL.
      }
    }

    // Submit in-app to feedback collection.
    let submitted = false;
    try {
      const db = getFirebaseDb();
      if (db) {
        await addDoc(collection(db, "feedback"), {
          to: SUPPORT_EMAIL,
          type,
          name: name.trim(),
          country: country.trim(),
          email: originEmail || "",
          message: message.trim(),
          steps: steps.trim() || "",
          fileUrl: fileUrl || "",
          fileName: file?.name || "",
          uid: user?.uid || "",
          url: window.location.href,
          userAgent: navigator.userAgent,
          createdAt: serverTimestamp(),
        });
        submitted = true;
      }
    } catch {
      submitted = false;
    }

    if (!submitted) {
      setSubmitError(
        `Feedback could not be saved right now. Please email ${SUPPORT_EMAIL} directly.`,
      );
      setSending(false);
      return;
    }

    // Email notification is handled automatically by Firebase Cloud Function
    // triggered on feedback document creation.

    setSent(true);
    setMessage("");
    setSteps("");
    setFile(null);
    if (!user?.email) setEmail("");
    setTimeout(() => {
      setSent(false);
      setOpen(false);
    }, 3000);
    setSending(false);
  };

  return (
    <>
      <button
        className="beta-fab"
        onClick={() => setOpen(!open)}
        title="Beta - Help us build this!"
        aria-label="Beta feedback"
      >
        <span className="beta-fab-shimmer" />
        <span className="beta-fab-label">Beta</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="p-0 border-0 bg-transparent shadow-none sm:rounded-none max-w-none flex items-center justify-center"
          hideClose
        >
          <div className="beta-popup">
            <button
              className="beta-popup-close"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              {"\u2715"}
            </button>

            <div className="beta-popup-header">
              <div className="beta-popup-icon">
                <svg viewBox="0 0 48 48" fill="none">
                  <circle
                    cx="24"
                    cy="24"
                    r="22"
                    fill="url(#betaGrad)"
                    opacity="0.15"
                  />
                  <path
                    d="M24 8L28 18H38L30 24L33 34L24 28L15 34L18 24L10 18H20L24 8Z"
                    fill="url(#betaGrad)"
                    stroke="url(#betaGrad)"
                    strokeWidth="1.5"
                  />
                  <defs>
                    <linearGradient id="betaGrad" x1="8" y1="8" x2="40" y2="40">
                      <stop stopColor="#3b82f6" />
                      <stop offset="1" stopColor="#8b5cf6" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <div>
                <h4 id="beta-feedback-title">Help us finish Polymorpha</h4>
                <p className="beta-popup-intro">
                  You're using a beta build. Report bugs, suggest features, or
                  just say hi. Bug hunters get free premium access at launch and
                  a spot in our credits.
                </p>
              </div>
            </div>

            {sent ? (
              <div className="beta-feedback-thanks">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="beta-thanks-icon"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    fill="#16a34a"
                    opacity="0.15"
                  />
                  <path
                    d="M8 12l3 3 5-5"
                    stroke="#16a34a"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>
                  Thanks. Your feedback was submitted to support@polymorpha.io.
                </span>
              </div>
            ) : (
              <>
                <div className="beta-feedback-type-row">
                  <button
                    className={`beta-type-btn${type === "bug" ? " active" : ""}`}
                    onClick={() => setType("bug")}
                  >
                    <svg
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      className="beta-type-icon"
                    >
                      <path d="M8 1a3 3 0 00-3 3v.5H3.5a.5.5 0 000 1h1.707A4.5 4.5 0 005 7H3.5a.5.5 0 000 1H5v1H3.5a.5.5 0 000 1H5.05A3.5 3.5 0 008 13.95 3.5 3.5 0 0010.95 10H12.5a.5.5 0 000-1H11V8h1.5a.5.5 0 000-1H11a4.5 4.5 0 00-.207-1.5H12.5a.5.5 0 000-1H11V4a3 3 0 00-3-3z" />
                    </svg>
                    Bug
                  </button>
                  <button
                    className={`beta-type-btn${type === "feature" ? " active" : ""}`}
                    onClick={() => setType("feature")}
                  >
                    <svg
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      className="beta-type-icon"
                    >
                      <path d="M8 1a.5.5 0 01.5.5V7h5.5a.5.5 0 010 1H8.5v5.5a.5.5 0 01-1 0V8H2a.5.5 0 010-1h5.5V1.5A.5.5 0 018 1z" />
                    </svg>
                    Feature
                  </button>
                  <button
                    className={`beta-type-btn${type === "general" ? " active" : ""}`}
                    onClick={() => setType("general")}
                  >
                    <svg
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      className="beta-type-icon"
                    >
                      <path d="M8 15A7 7 0 108 1a7 7 0 000 14zm0-1A6 6 0 108 2a6 6 0 000 12zM6.5 6a.5.5 0 000 1h3a.5.5 0 000-1h-3zm0 3a.5.5 0 000 1h3a.5.5 0 000-1h-3z" />
                    </svg>
                    General
                  </button>
                </div>

                <div className="beta-field-row">
                  <div className="beta-field">
                    <label className="beta-label">
                      Name <span className="beta-req">*</span>
                    </label>
                    <input
                      className="beta-input"
                      type="text"
                      placeholder="Your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="beta-field">
                    <label className="beta-label">
                      Country <span className="beta-req">*</span>
                    </label>
                    <input
                      className="beta-input"
                      type="text"
                      placeholder="e.g. Australia"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                    />
                  </div>
                </div>

                <div className="beta-field">
                  <label className="beta-label">Email (origin, optional)</label>
                  <input
                    className="beta-input"
                    type="email"
                    placeholder="Optional: where this feedback came from"
                    value={user?.email || email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={!!user?.email}
                  />
                  <p className="beta-field-caption">
                    Optional: add your email in case we need to follow up.
                  </p>
                </div>

                <div className="beta-field">
                  <label className="beta-label">
                    {type === "bug"
                      ? "What happened?"
                      : type === "feature"
                        ? "What do you need?"
                        : "Your feedback"}{" "}
                    <span className="beta-req">*</span>
                  </label>
                  <textarea
                    className="beta-feedback-textarea"
                    placeholder={
                      type === "bug"
                        ? "Describe what went wrong..."
                        : type === "feature"
                          ? "Describe the feature..."
                          : "Tell us anything..."
                    }
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                  />
                </div>

                {type === "bug" && (
                  <div className="beta-field">
                    <label className="beta-label">Steps to reproduce</label>
                    <textarea
                      className="beta-feedback-textarea beta-steps"
                      placeholder={
                        "1. Upload a CSV file\n2. Click 'Run Statistics'\n3. Error appears..."
                      }
                      value={steps}
                      onChange={(e) => setSteps(e.target.value)}
                      rows={3}
                    />
                  </div>
                )}

                <div className="beta-field">
                  <label className="beta-label">
                    Attach file (screenshot or CSV)
                  </label>
                  <div
                    className="beta-file-drop"
                    onClick={() => fileRef.current?.click()}
                  >
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".csv,.png,.jpg,.jpeg,.gif,.webp,.pdf"
                      style={{ display: "none" }}
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                    {file ? (
                      <span className="beta-file-name">{file.name}</span>
                    ) : (
                      <span className="beta-file-placeholder">
                        <svg
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="beta-upload-icon"
                        >
                          <path d="M10 3a.75.75 0 01.75.75v6.5h6.5a.75.75 0 010 1.5h-6.5v6.5a.75.75 0 01-1.5 0v-6.5h-6.5a.75.75 0 010-1.5h6.5v-6.5A.75.75 0 0110 3z" />
                        </svg>
                        Click to upload
                      </span>
                    )}
                  </div>
                </div>

                <button
                  className="btn-primary beta-feedback-send"
                  onClick={handleSubmit}
                  disabled={sending || !canSubmit}
                >
                  {sending ? "Sending..." : "Submit Feedback"}
                </button>
                {submitError ? (
                  <p className="beta-submit-error">{submitError}</p>
                ) : null}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
