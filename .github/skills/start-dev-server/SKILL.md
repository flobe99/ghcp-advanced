---
name: start-dev-server
description: Use when the user asks to start, run, or launch the TypeScript development server. Also use when the user wants to see the app running locally.
---

1. Check whether the project has a `dev` script in `package.json`. Read `package.json` and look for a `scripts.dev` entry.

   - If `dev` is defined, run:

     ```bash
     npm run dev
     ```

   - If `dev` is not defined, fall back to running the entry point directly:

     ```bash
     npx tsx src/index.ts
     ```

2. Wait for the server to print its listening address (e.g. `Listening on http://localhost:3000`). If it does not start within 30 seconds, read the error output and report it to the user.

3. Once the server is running, tell the user:
   - The URL it is listening on (default: `http://localhost:3000`).
   - Any environment variables that must be set first (e.g. `PORT`, `ADMIN_PASSWORD`) — read these from an `.env.example` file if present.

4. Do **not** stop the server unless the user asks. Keep it running in the background so the user can test the app.
