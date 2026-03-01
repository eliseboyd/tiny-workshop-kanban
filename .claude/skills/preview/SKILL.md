---
name: preview
description: Use this skill when the user wants to "preview", "test locally", "run the dev server", "spin up the server", "check changes locally", or wants to verify their work before deploying.
version: 1.0.0
---

# Preview: Start Local Dev Server and Verify Changes

This skill starts the Next.js dev server in the background, opens the app in the browser, and helps verify changes look correct before deploying.

## Steps

### 1. Check for Running Server

Check if a dev server is already running on port 3000:
```
lsof -ti :3000
```
If a process is found, let the user know and ask if they want to kill it and restart, or reuse the existing server.

### 2. Start the Dev Server

Start the dev server in the background:
```
npm run dev > /tmp/next-dev.log 2>&1 &
```

Then wait for it to be ready by polling the log:
```
until grep -q "Ready" /tmp/next-dev.log || grep -q "Local:" /tmp/next-dev.log; do sleep 1; done
```

Timeout after 30 seconds if the server hasn't started.

### 3. Open in Browser

Once ready, open `http://localhost:3000` in the browser using:
```
open http://localhost:3000
```

### 4. Show Server Output

Print the last few lines of the dev server log so the user can see the startup output and any warnings:
```
tail -20 /tmp/next-dev.log
```

### 5. Prompt for Manual Verification

Ask the user to verify their changes in the browser. Prompt them with:
- "Does everything look correct?"
- "Any console errors or issues to fix?"

Wait for their feedback before finishing.

### 6. Offer Next Steps

After the user confirms their changes look good, suggest:
- Run `/deploy` to ship the changes to production
- Or continue making edits and re-check

## Rules

- Always check for an existing server before starting a new one
- Use `npm run dev` (not `next dev` directly) so it respects any project-level config
- Never kill an existing server without asking the user first
- Log output goes to `/tmp/next-dev.log` to avoid polluting the terminal
- If the server fails to start, show the full log output for debugging
- The dev server runs in the background — remind the user it will stay running after this skill completes

## Troubleshooting

- **Port 3000 in use**: Ask the user before killing the existing process
- **Server won't start**: Show `/tmp/next-dev.log` contents; common causes are missing `.env.local` or failed builds
- **Build errors**: Show the error and suggest fixing before deploying
