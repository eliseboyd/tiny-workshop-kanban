---
name: deploy
description: This skill should be used when the user asks to "deploy", "commit and deploy", "push and deploy", "ship", "release", "deploy to netlify", "commit to github and deploy", or wants to publish their changes live. Netlify auto-deploys from main — no manual verification needed.
version: 2.0.0
---

# Deploy: Commit, Merge, and Ship to Netlify

This skill commits changes, creates a PR, and merges into main. Netlify auto-deploys from main.

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
- Merging triggers Netlify's auto-deploy on main — check the [Netlify dashboard](https://app.netlify.com) for deploy status

## Rules

- When running shell commands, avoid quoted strings in arguments where possible (e.g. use `git status && git diff HEAD`, not `git status && echo "---" && git diff HEAD`)
- Always show the user what files will be committed before committing
- Use conventional commit format: `type(scope): message`
- If already on a feature branch (not `main`), skip branch creation
- Branch names derived from the commit message, e.g. `feat/add-auth` or `fix/mobile-layout`
- Merge with `--squash` to keep main history clean and `--delete-branch` to clean up

## Example Commit Messages

- `feat: add user authentication`
- `fix: resolve mobile layout issue`
- `chore: update dependencies`
- `style: improve button hover states`
