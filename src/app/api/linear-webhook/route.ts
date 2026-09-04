// Receives Linear webhooks, verifies signature, and forwards qualifying issues
// to GitHub via repository_dispatch. Ported from netlify/functions/linear-webhook.js
// at the Vercel move; the Linear webhook URL points at
// https://kanban.tinywork.shop/kanban/api/linear-webhook.

import crypto from 'node:crypto';

// Status name that triggers the automation. Must match the Linear workflow exactly.
const TRIGGER_STATUS = 'Ready for Dev';

export async function POST(request: Request) {
  // ── 1. Verify Linear webhook signature ──────────────────────────────────────
  const signature = request.headers.get('linear-signature');
  const secret = process.env.LINEAR_WEBHOOK_SECRET;
  const rawBody = await request.text();

  if (!secret) {
    console.error('LINEAR_WEBHOOK_SECRET env var is not set');
    return new Response('Server misconfiguration', { status: 500 });
  }

  if (!signature) {
    return new Response('Missing signature', { status: 401 });
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('hex');

  let signaturesMatch = false;
  try {
    signaturesMatch = crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex'),
    );
  } catch {
    // malformed hex / length mismatch
  }

  if (!signaturesMatch) {
    return new Response('Invalid signature', { status: 401 });
  }

  // ── 2. Parse payload ────────────────────────────────────────────────────────
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  // Only act on Issue update events where the status has changed.
  const { type, action, data, updatedFrom } = payload;

  if (type !== 'Issue' || action !== 'update') {
    return new Response('Ignored: not an issue update', { status: 200 });
  }

  // Require a state change and confirm the *new* state is "Ready for Dev".
  const newStateName = data?.state?.name;
  const oldStateName = updatedFrom?.stateName;

  if (newStateName !== TRIGGER_STATUS) {
    return new Response(`Ignored: status is "${newStateName}"`, { status: 200 });
  }

  if (oldStateName === TRIGGER_STATUS) {
    // Already was in this state — avoid duplicate triggers on unrelated updates.
    return new Response('Ignored: status unchanged', { status: 200 });
  }

  // ── 3. Extract issue fields ─────────────────────────────────────────────────
  const issue = {
    id: data.identifier, // e.g. "ENG-42"
    title: data.title,
    description: data.description || '',
    url: data.url,
  };

  console.log(`Forwarding issue ${issue.id} to GitHub dispatch`);

  // ── 4. Fire GitHub repository_dispatch ─────────────────────────────────────
  const githubToken = process.env.GITHUB_TOKEN;
  const githubRepo = process.env.GITHUB_REPO; // format: "owner/repo"

  if (!githubToken || !githubRepo) {
    console.error('GITHUB_TOKEN or GITHUB_REPO env var is not set');
    return new Response('Server misconfiguration', { status: 500 });
  }

  const dispatchUrl = `https://api.github.com/repos/${githubRepo}/dispatches`;

  const response = await fetch(dispatchUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${githubToken}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      event_type: 'linear-issue-ready',
      client_payload: {
        issue_id: issue.id,
        issue_title: issue.title,
        issue_description: issue.description,
        issue_url: issue.url,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`GitHub dispatch failed: ${response.status} ${body}`);
    return new Response('Failed to dispatch to GitHub', { status: 502 });
  }

  return Response.json({ dispatched: true, issue: issue.id });
}
