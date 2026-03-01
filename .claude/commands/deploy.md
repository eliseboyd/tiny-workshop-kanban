---
allowed-tools: Bash(git *), Bash(gh pr *), Bash(cat .netlify/state.json), Bash(sleep *), mcp__claude_ai_Netlify__netlify-deploy-services-reader
description: Commit, merge to main, and verify Netlify deploy is live
---

## Context

- Current git status: !`git status`
- Current git diff (staged and unstaged changes): !`git diff HEAD`
- Current branch: !`git branch --show-current`
- Netlify site ID: !`cat .netlify/state.json`

## Your task

Ship the current changes to production. Follow these steps in order:

### 1. Show changes and confirm
Show the user a brief summary of what files changed. Wait for confirmation before proceeding.

### 2. Stage and commit
- If on `main`, create a feature branch first (name derived from changes, e.g. `feat/add-auth`)
- If already on a feature branch, stay on it
- Stage all changes with `git add -A`
- Commit with a conventional commit message: `type(scope): message`

### 3. Push and open PR
- Push the branch to origin
- Open a PR to `main` using `gh pr create` with a brief description

### 4. Merge the PR
- Merge using `gh pr merge --squash --delete-branch`
- This triggers Netlify auto-deploy on main

### 5. Verify Netlify deploy
- Use `netlify-deploy-services-reader` with `get-deploy-for-site` operation (siteId from context above) to check the latest deploy
- Poll every ~15 seconds until deploy state is `ready` or an error occurs
- Timeout after 5 minutes
- Report the final deploy URL on success, or the error details on failure
