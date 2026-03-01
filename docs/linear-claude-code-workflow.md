# Runbook: Linear → Claude Code → GitHub PR

This document explains how to set up and operate the automated workflow that turns a Linear issue into a GitHub PR — without any human touching a keyboard.

```
Linear issue → "Ready for Dev"
  └─► Linear webhook
        └─► Netlify Function (linear-webhook.js)  ← verifies signature, filters status
              └─► GitHub repository_dispatch
                    └─► GitHub Action (linear-claude-code.yml)
                          └─► Claude Code CLI
                                └─► git branch + commit + PR
```

---

## Prerequisites

| Tool | Minimum version |
|------|----------------|
| Node.js | 20 |
| Claude Code CLI | latest (`npm i -g @anthropic-ai/claude-code`) |
| GitHub CLI (`gh`) | latest |
| Netlify CLI (optional, for local testing) | latest |

---

## 1 — Linear setup

### 1.1 Create a "Ready for Dev" status

In your Linear workspace:

1. **Settings → Teams → \<your team\> → Workflow**
2. Add a status named exactly **`Ready for Dev`** in the *Started* or *Unstarted* group.
3. Note the name — it must match `TRIGGER_STATUS` in `netlify/functions/linear-webhook.js`.

### 1.2 Create a webhook

1. **Settings → API → Webhooks → New webhook**
2. **URL**: `https://<your-netlify-site>.netlify.app/.netlify/functions/linear-webhook`
3. **Events to send**: `Issues` (check the box)
4. Copy the **Signing secret** — you will need it as `LINEAR_WEBHOOK_SECRET`.
5. Save the webhook.

---

## 2 — GitHub setup

### 2.1 Personal Access Token (PAT)

The workflow needs a PAT with:

- `repo` (full)
- `workflow`

Create one at **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens** and store it as:

- GitHub secret: **`GH_PAT`**
- Netlify env var: **`GITHUB_TOKEN`**

> **Why two places?** Netlify uses it to call the GitHub API; the GitHub Action uses it to push branches and open PRs.

### 2.2 Anthropic API key

Store your Anthropic API key as a GitHub Actions secret:

- Secret name: **`ANTHROPIC_API_KEY`**

---

## 3 — Netlify setup

### 3.1 Environment variables

Add these in **Netlify → Site → Environment variables** (or via `netlify.toml` using `[context.production.environment]`):

| Variable | Value | Notes |
|----------|-------|-------|
| `LINEAR_WEBHOOK_SECRET` | from Linear webhook settings | HMAC signing secret |
| `GITHUB_TOKEN` | GitHub PAT (§ 2.1) | must have `repo` scope |
| `GITHUB_REPO` | `owner/repo` | e.g. `acme/tiny-workshop-kanban` |

### 3.2 Deploy the function

The function is at `netlify/functions/linear-webhook.js`. Netlify picks it up automatically when you deploy.

```bash
# Deploy to production
netlify deploy --prod
```

The function will be available at:
```
https://<your-site>.netlify.app/.netlify/functions/linear-webhook
```

### 3.3 Local testing with Netlify Dev

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Start local dev server (exposes functions at http://localhost:8888)
netlify dev

# In a second terminal, use ngrok or similar to expose localhost:
ngrok http 8888

# Point the Linear webhook at:
# https://<ngrok-subdomain>.ngrok.io/.netlify/functions/linear-webhook
```

---

## 4 — GitHub Actions setup

The workflow file is already at `.github/workflows/linear-claude-code.yml`.

### 4.1 Required secrets

Add these under **GitHub → Settings → Secrets and variables → Actions**:

| Secret | Description |
|--------|-------------|
| `GH_PAT` | GitHub PAT with `repo` + `workflow` scopes |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude Code |

### 4.2 How it works (step by step)

1. **Checkout** — fetches the full history so branch creation works.
2. **Node setup** — Node 20, matches CI.
3. **`npm ci`** — installs dependencies so lint/type-check can run inside the Claude session.
4. **Install Claude Code** — `npm install -g @anthropic-ai/claude-code`.
5. **Create branch** — `linear/<sanitised-issue-id>` off `main`.
6. **Claude Code** — receives the issue ID, title, description, and URL as context; reads `CLAUDE.md`; implements the issue; stages changes.
7. **Commit** — bot commits with a conventional commit message.
8. **Push** — pushes the branch to origin.
9. **Open PR** — `gh pr create` with the Linear URL in the description.

---

## 5 — CLAUDE.md

`CLAUDE.md` (repository root) is the instruction file Claude reads before writing any code. Keep it accurate:

- Stack and tool versions
- How to run lint and type-check
- Naming conventions, file structure
- Patterns to follow and avoid
- PR requirements

The more precise `CLAUDE.md` is, the better Claude's output will be.

---

## 6 — End-to-end test

1. Move any issue to **Ready for Dev** in Linear.
2. Check **Netlify → Functions → linear-webhook** logs — you should see a `200` response and a log line like `Forwarding issue ENG-42 to GitHub dispatch`.
3. Check **GitHub → Actions** — the `Linear → Claude Code` run should appear within seconds.
4. Watch the run complete. A PR should appear at `github.com/<owner>/<repo>/pulls`.

---

## 7 — Troubleshooting

### Webhook not firing

- Confirm the webhook URL in Linear matches your Netlify URL exactly (include `/.netlify/functions/linear-webhook`).
- Check that **Issues** is ticked in Linear's webhook event list.
- In Netlify, go to **Functions → linear-webhook → logs** and check for invocations.

### `401 Invalid signature`

- The `LINEAR_WEBHOOK_SECRET` env var in Netlify does not match the secret shown in Linear's webhook settings.
- Re-copy the secret from Linear (Settings → API → Webhooks → your webhook → Signing secret).

### `Ignored: status is "..."`

- The status name in Linear does not match `TRIGGER_STATUS = 'Ready for Dev'` in `linear-webhook.js`.
- Either rename the Linear status or update the constant.

### GitHub dispatch returns non-200

- The `GITHUB_TOKEN` in Netlify may be expired or missing `repo` scope.
- The `GITHUB_REPO` value may be wrong — check `owner/repo` is correct.

### Action runs but no files are changed

- Claude may not have found a clear implementation path. Check the action logs for Claude's output.
- The issue description may be too vague — add acceptance criteria in Linear.
- `CLAUDE.md` may be missing required context (test commands, file layout, etc.).

### Commit step fails with "No staged changes"

- Claude ran but staged nothing. Check the Claude step's output in the action log.
- This can happen if Claude decided no code changes were needed. Review the issue description.

### PR already exists

- A PR for this branch may already be open. The `gh pr create` step will fail with a non-zero exit. Close or merge the existing PR and re-trigger.

### TypeScript / lint errors in the PR

- The CI workflow will catch these automatically.
- Claude is instructed to run `npx tsc --noEmit` and `npm run lint` inside its session. If it still produces errors, update `CLAUDE.md` with clearer guidance or stricter examples.

---

## 8 — Security notes

- **Signature verification**: The Netlify function uses constant-time HMAC comparison (`crypto.timingSafeEqual`) to prevent timing attacks.
- **Scope the PAT**: Use a fine-grained PAT limited to this repository only.
- **Secrets in Actions**: `ANTHROPIC_API_KEY` is never echoed to logs because GitHub automatically redacts registered secrets.
- **Allowed tools**: The `--allowedTools` flag in the Claude Code invocation limits Claude to read/write file operations and `Bash`. It cannot make outbound network requests.
- **Bot commits**: Commits are attributed to `claude-code[bot]` — easy to identify in history.

---

## 9 — Extending the workflow

| Idea | How |
|------|-----|
| Post a comment back to Linear when the PR opens | Add a step after `gh pr create` that calls the Linear GraphQL API |
| Auto-merge on passing CI | Add `gh pr merge --auto --squash` as a final step |
| Support multiple trigger statuses | Change `TRIGGER_STATUS` to an array and check `Array.includes()` |
| Route to different branches by issue label | Read `data.labels` in the webhook and set `base` accordingly in the action |
| Notify Slack on failure | Add a `if: failure()` step using the Slack webhook action |
