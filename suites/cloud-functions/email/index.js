/**
 * Firebase Cloud Function — Feedback Email Notification
 *
 * Triggers when a new document is created in the 'feedback' Firestore collection
 * and sends a notification email via Resend API.
 *
 * Setup:
 *   firebase functions:secrets:set RESEND_API_KEY
 *
 * Deploy:
 *   firebase deploy --only functions:onFeedbackCreated
 */

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions");

const resendApiKey = defineSecret("RESEND_API_KEY");

const FEEDBACK_TO = "support@polymorpha.io";
const FEEDBACK_FROM = "Polymorpha Feedback <noreply@polymorpha.io>";

exports.onFeedbackCreated = onDocumentCreated(
  {
    document: "feedback/{docId}",
    secrets: [resendApiKey],
    region: "us-central1",
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) {
      logger.warn("No data in feedback document");
      return;
    }

    const { message, rating, email: userEmail, createdAt } = data;

    const subject = `[Polymorpha Feedback] ${rating ? `Rating: ${rating}/5` : "New feedback"}`;
    const htmlBody = `
      <h2>New Beta Feedback</h2>
      <table style="border-collapse:collapse;font-family:sans-serif;">
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Rating</td><td>${rating ?? "N/A"}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Message</td><td>${escapeHtml(message || "(empty)")}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">User Email</td><td>${escapeHtml(userEmail || "Not provided")}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Submitted</td><td>${createdAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString()}</td></tr>
      </table>
    `;

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey.value()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FEEDBACK_FROM,
          to: [FEEDBACK_TO],
          subject,
          html: htmlBody,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        logger.error("Resend API error", { status: res.status, body: errorText });
        return;
      }

      logger.info("Feedback email sent successfully", { docId: event.params.docId });
    } catch (err) {
      logger.error("Failed to send feedback email", { error: err.message });
    }
  }
);

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
