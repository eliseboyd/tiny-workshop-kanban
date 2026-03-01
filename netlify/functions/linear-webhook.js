// netlify/functions/linear-webhook.js
// Receives Linear webhooks, verifies signature, and forwards qualifying issues
// to GitHub via repository_dispatch.

const crypto = require('crypto');

// Status name that triggers the automation. Must match your Linear workflow exactly.
const TRIGGER_STATUS = 'Ready for Dev';

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // ── 1. Verify Linear webhook signature ──────────────────────────────────────
  const signature = event.headers['linear-signature'];
  const secret = process.env.LINEAR_WEBHOOK_SECRET;

  if (!secret) {
    console.error('LINEAR_WEBHOOK_SECRET env var is not set');
    return { statusCode: 500, body: 'Server misconfiguration' };
  }

  if (!signature) {
    return { statusCode: 401, body: 'Missing signature' };
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(event.body, 'utf8')
    .digest('hex');

  const signaturesMatch = crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex'),
  );

  if (!signaturesMatch) {
    return { statusCode: 401, body: 'Invalid signature' };
  }

  // ── 2. Parse payload ────────────────────────────────────────────────────────
  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  // Only act on Issue update events where the status has changed.
  const { type, action, data, updatedFrom } = payload;

  if (type !== 'Issue' || action !== 'update') {
    return { statusCode: 200, body: 'Ignored: not an issue update' };
  }

  // Require a state change and confirm the *new* state is "Ready for Dev".
  const newStateName = data?.state?.name;
  const oldStateName = updatedFrom?.stateName;

  if (newStateName !== TRIGGER_STATUS) {
    return { statusCode: 200, body: `Ignored: status is "${newStateName}"` };
  }

  if (oldStateName === TRIGGER_STATUS) {
    // Already was in this state — avoid duplicate triggers on unrelated updates.
    return { statusCode: 200, body: 'Ignored: status unchanged' };
  }

  // ── 3. Extract issue fields ─────────────────────────────────────────────────
  const issue = {
    id: data.identifier,        // e.g. "ENG-42"
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
    return { statusCode: 500, body: 'Server misconfiguration' };
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
    return { statusCode: 502, body: 'Failed to dispatch to GitHub' };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ dispatched: true, issue: issue.id }),
  };
};
