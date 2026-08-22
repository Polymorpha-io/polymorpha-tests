# Feedback Email Cloud Function

Firestore-triggered Cloud Function that sends an email notification via Resend whenever a new document is added to the `feedback` collection.

## Prerequisites

- Firebase CLI: `npm install -g firebase-tools`
- Resend account with verified domain (polymorpha.io)

## Setup

```bash
# Login to Firebase
firebase login

# Set the Resend API key as a secret
firebase functions:secrets:set RESEND_API_KEY
```

## Deploy

```bash
firebase deploy --only functions
```

## How It Works

1. User submits feedback in the app → written to Firestore `feedback` collection
2. Cloud Function triggers automatically on document creation
3. Function reads the feedback data and sends a formatted email via Resend API
4. Email arrives at support@polymorpha.io
