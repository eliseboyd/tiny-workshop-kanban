---
name: deploy
description: This skill should be used when the user asks to "deploy", "commit and deploy", "push and deploy", "ship", "release", "deploy to netlify", "commit to github and deploy", or wants to publish their changes live.
version: 2.0.0
---

# Deploy: Commit, Merge, and Ship to Netlify

This skill commits changes, creates a PR, merges into main, and verifies the Netlify deploy is live.

## Steps

### 1. Check What Changed

Run `git status` and `git diff HEAD` to identify all staged and unstaged changes. Show the user a summary of files that will be committed before proceeding.

### 2. Stage and Commit

- Stage all relevant changes with `git add`
- Commit with a conventional commit message (e.g. `feat:`, `fix:`, `chore:`)
- If on `main`, create a feature branch first (name derived from the commit, e.g. `feat/add-auth`)
- If already on a feature branch, commit directly there

### 3. Push and Open PR

- Push the branch to origin
- Open a PR to `main` using `gh pr create` with a brief description of the changes

### 4. Merge the PR

- Merge the PR using `gh pr merge --squash --delete-branch`
- This triggers Netlify's auto-deploy on main

### 5. Verify Netlify Deploy

- Read the site ID from `.netlify/state.json` (fallback: `5399662c-9c4a-4b42-b255-7e8d7e30c1ee`)
- Use `netlify-deploy-services-reader` with `get-deploy-for-site` to check the latest deploy status
- Poll every ~15 seconds until the deploy state is `ready` or an error occurs
- Timeout after 5 minutes if the deploy hasn't completed
- Report the final deploy URL on success, or the error on failure

## Rules

- Always show the user what files will be committed before committing
- Use conventional commit format: `type(scope): message`
- If already on a feature branch (not `main`), skip branch creation
- Branch names derived from the commit message, e.g. `feat/add-auth` or `fix/mobile-layout`
- Merge with `--squash` to keep main history clean and `--delete-branch` to clean up
- If no site ID is found in `.netlify/state.json`, ask: "What is your Netlify site ID?"
- If deploy fails or times out, suggest checking the Netlify dashboard

## Example Commit Messages

- `feat: add user authentication`
- `fix: resolve mobile layout issue`
- `chore: update dependencies`
- `style: improve button hover states`
