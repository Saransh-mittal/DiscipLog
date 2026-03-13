# Google OAuth Quickstart Guide

To use DiscipLog's NextAuth setup correctly, you need to register the app with Google Cloud.

## Steps
1. Navigate to the [Google Cloud Console](https://console.cloud.google.com).
2. Create a new Project (e.g., `DiscipLog`).
3. Open the navigation menu and go to **APIs & Services > Credentials**.
4. Click **Create Credentials** -> **OAuth client ID**.
5. You may need to configure the **OAuth consent screen** first with generic details (App Name: DiscipLog, Support Email: yours). Select "External" or "Internal" depending on your Google Workspace constraints.
6. Once configured, resume creating the OAuth Client ID.
7. Application Type: **Web application**
8. Authorized JavaScript origins:
   - `http://localhost:3000` (Dev)
   - `https://your-app-domain.up.railway.app` (Prod)
9. Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://your-app-domain.up.railway.app/api/auth/callback/google`
10. Click Create!

## Environment Setup
Copy the displayed `Client ID` into `GOOGLE_CLIENT_ID` in your `.env.local`
Copy the displayed `Client Secret` into `GOOGLE_CLIENT_SECRET` in your `.env.local`

Generate a secure NextAuth secret using `openssl rand -base64 32` and add it to `NEXTAUTH_SECRET`.
