---
allowed-tools: Bash(lsof *), Bash(npm run dev *), Bash(until *), Bash(tail *), Bash(open *), Bash(kill *), Bash(sleep *)
description: Start the local dev server and verify changes before deploying
---

## Context

- Current branch: !`git branch --show-current`
- Current git status: !`git status --short`
- Port 3000 status: !`lsof -ti :3000 && echo "IN USE" || echo "free"`

## Your task

Start the local dev server and help the user verify their changes look correct. Follow these steps:

### 1. Check for existing server

If port 3000 is already in use, tell the user and ask if they want to kill it and restart, or keep using it.

### 2. Start the dev server

If no server is running, start it in the background:
```
npm run dev > /tmp/next-dev.log 2>&1 &
```

Wait for it to be ready (poll `/tmp/next-dev.log` for "Ready" or "Local:", timeout after 30s).

### 3. Open the browser

Once ready, run `open http://localhost:3000`.

### 4. Show startup output

Print the last 20 lines of `/tmp/next-dev.log` so the user can see any warnings or errors.

### 5. Ask the user to verify

Prompt them to check the app in their browser. Ask:
- Does everything look correct?
- Any console errors or visual issues?

### 6. Suggest next steps

If they confirm it looks good, remind them they can run `/deploy` to ship to production.
