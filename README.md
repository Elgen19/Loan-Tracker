# Loan Tracker App

A simple web-based loan tracking app built with a FERN-style setup:

- Firebase Firestore for data storage
- Express + Node.js API
- React frontend with Vite

## Features

- Add loan information
- Track due dates
- Record payments
- View loan balances and payment history

## Project Structure

```text
client/  React frontend
server/  Express API and Firestore integration
```

## Setup

1. Install dependencies from the repo root:

```bash
npm install
```

2. Create `server/.env` with your Firebase service account values:

```env
PORT=5000
FIREBASE_SERVICE_ACCOUNT_PATH=C:\path\to\service-account.json
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-client-email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
CLIENT_ORIGIN=http://localhost:5173
ALLOWED_USER_EMAILS=firstperson@example.com,secondperson@example.com
SHARED_WORKSPACE_ID=faith-workspace
REQUIRE_EMAIL_VERIFIED=false
```

You can use either:

- `FIREBASE_SERVICE_ACCOUNT_PATH` pointing to the downloaded Firebase service-account JSON file
- or the individual `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` values

3. Create `client/.env`:

```env
VITE_API_URL=http://localhost:5000/api
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_APP_ID=your_app_id
```

4. Start the app:

```bash
npm run dev
```

## API Endpoints

- `GET /api/health`
- `GET /api/loans`
- `POST /api/loans`
- `GET /api/loans/:loanId`
- `POST /api/loans/:loanId/payments`

## Security Notes

- Access is limited to the comma-separated emails in `ALLOWED_USER_EMAILS`
- Both approved users share the same workspace through `SHARED_WORKSPACE_ID`
- Set `REQUIRE_EMAIL_VERIFIED=true` if you want to block unverified email accounts
- The server applies API rate limiting and writes audit logs for important changes
- Keep the Firebase service-account JSON on the server only
- Use HTTPS in production

## Firestore Shape

Collection: `loans`

Each document stores:

- `title`
- `lender`
- `originalAmount`
- `currentBalance`
- `monthlyPayment`
- `dueDate`
- `notes`
- `status`
- `createdAt`
- `updatedAt`
- `payments`
