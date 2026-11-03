/**
 * POST /api/enquiry  — Cloudflare Pages Function
 *
 * Receives the "Get in Touch" form (JSON), validates + sanitises it on the server,
 * and sends it to the company inbox through the Resend transactional-email API.
 * Secrets live ONLY in Cloudflare environment variables — never in frontend code.
 *
 * Environment variables (Pages → Settings → Variables and Secrets):
 *   RESEND_API_KEY      (secret, required)  API key from resend.com
 *   TO_EMAIL            (optional)          default: jayachandar1j@gmail.com
 *   FROM_EMAIL          (optional)          default: "KVK Website <onboarding@resend.dev>"
 *   TURNSTILE_SECRET    (optional secret)   enables Cloudflare Turnstile CAPTCHA verification
 *   ALLOWED_ORIGINS     (optional)          comma-separated extra origins allowed to post
 *   DB                  (optional D1 binding) enquiries are also saved if bound (see db/schema.sql)
 */

const DEFAULT_TO = 'jayachandar1j@gmail.com';
const SUBJECT = 'New Website Enquiry \u2013 KVK Construction';
const MAX = { name: 100, email: 254, phone: 20, company: 120, message: 3000 };
const MIN_FILL_MS = 2500; // humans need a moment to fill a form; bots post instantly

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
  });

/* ---------- validation / sanitising (exported for tests) ---------- */
export function clean(v, max, { multiline = false } = {}) {
  let s = typeof v === 'string' ? v : '';
  s = s.normalize('NFKC');
  // strip control chars (keep \n for multiline), collapse whitespace
  s = s.replace(multiline ? /[\u0000-\u0009\u000B-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, '');
  s = multiline ? s.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n') : s.replace(/\s+/g, ' ');
  return s.trim().slice(0, max);
}

const EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

export function validate(input) {
  const d = {
    name: clean(input.name, MAX.name),
    email: clean(input.email, MAX.email).toLowerCase(),
    phone: clean(input.phone, MAX.phone),
    company: clean(input.company, MAX.company),
    message: clean(input.message, MAX.message, { multiline: true }),
  };
  const errors = {};
  if (d.name.length < 2) errors.name = 'Please enter your full name.';
  if (!d.email) errors.email = 'Please enter your email address.';
  else if (!EMAIL_RE.test(d.email) || d.email.includes('..')) errors.email = 'Please enter a valid email address.';
  const digits = d.phone.replace(/\D/g, '');
  if (!d.phone) errors.phone = 'Please enter your phone number.';
  else if (!/^\+?[\d\s\-().]+$/.test(d.phone) || digits.length < 8 || digits.length > 15)
    errors.phone = 'Please enter a valid phone number (8–15 digits, e.g. +91 98765 43210).';
  if (d.message.length < 10) errors.message = 'Please enter at least 10 characters in your message.';
  return { data: d, errors };
}

const esc = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function buildEmail(d, meta) {
  const rows = [
    ['Name', d.name],
    ['Email', d.email],
    ['Phone', d.phone],
    ['Company', d.company || '—'],
  ];
  const text =
    rows.map(([k, v]) => `${k}: ${v}`).join('\n') +
    `\n\nMessage:\n${d.message}\n\n---\nReceived: ${meta.when}\nPage: ${meta.origin}\nIP: ${meta.ip}`;
  const html =
    `<div style="font-family:Arial,sans-serif;max-width:620px">` +
    `<h2 style="color:#0c2b50;margin:0 0 14px">New website enquiry</h2>` +
    `<table style="border-collapse:collapse;width:100%">` +
    rows.map(([k, v]) =>
      `<tr><td style="padding:8px 12px;border:1px solid #e3e9f0;background:#f5f7fa;width:110px;font-weight:bold">${k}</td>` +
      `<td style="padding:8px 12px;border:1px solid #e3e9f0">${esc(v)}</td></tr>`).join('') +
    `</table><h3 style="color:#0c2b50;margin:20px 0 6px">Message</h3>` +
    `<div style="white-space:pre-wrap;border-left:3px solid #f28b2c;padding:6px 14px">${esc(d.message)}</div>` +
    `<p style="color:#64748b;font-size:12px;margin-top:22px">Received ${esc(meta.when)} · ${esc(meta.origin)} · IP ${esc(meta.ip)}</p></div>`;
  return { text, html };
}

/* ---------- optional: Cloudflare D1 (not required; only runs when a DB binding exists) ---------- */
async function saveEnquiry(env, d, meta) {
  if (!env.DB) return { saved: false, reason: 'no D1 binding' };
  await env.DB.prepare(
    'INSERT INTO enquiries (name, email, phone, company, message, ip, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)'
  ).bind(d.name, d.email, d.phone, d.company, d.message, meta.ip, meta.when).run();
  return { saved: true };
}

async function verifyTurnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET) return true; // CAPTCHA not enabled
  if (!token) return false;
  const body = new FormData();
  body.append('secret', env.TURNSTILE_SECRET);
  body.append('response', token);
  if (ip) body.append('remoteip', ip);
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
  const j = await r.json().catch(() => ({}));
  return j.success === true;
}

function originAllowed(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return true; // non-browser clients; protected by the other checks
  const self = new URL(request.url).origin;
  if (origin === self) return true;
  return (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean).includes(origin);
}

/* ---------- handler ---------- */
export async function onRequestPost(context) {
  const { request, env } = context;

  if (!originAllowed(request, env)) return json({ ok: false, error: 'Request not allowed.' }, 403);
  if (!(request.headers.get('Content-Type') || '').includes('application/json'))
    return json({ ok: false, error: 'Unsupported request format.' }, 415);

  const raw = await request.text();
  if (raw.length > 20000) return json({ ok: false, error: 'Request too large.' }, 413);
  let input;
  try { input = JSON.parse(raw); } catch { return json({ ok: false, error: 'Invalid request.' }, 400); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return json({ ok: false, error: 'Invalid request.' }, 400);

  // Spam protection 1: honeypot — real users never fill this hidden field.
  // Respond like success so bots learn nothing, but send nothing.
  if (typeof input.website === 'string' && input.website.trim() !== '') return json({ ok: true, message: 'Thank you.' });

  // Spam protection 2: time trap
  const rendered = Number(input.ts);
  if (Number.isFinite(rendered) && Date.now() - rendered < MIN_FILL_MS)
    return json({ ok: false, error: 'Please take a moment to review your message and try again.' }, 429);

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

  // Spam protection 3: Turnstile CAPTCHA (when TURNSTILE_SECRET is configured)
  let human = false;
  try { human = await verifyTurnstile(env, input.token, ip); } catch { human = false; }
  if (!human) return json({ ok: false, error: 'Spam check failed. Please refresh the page and try again.' }, 400);

  const { data, errors } = validate(input);
  if (Object.keys(errors).length) return json({ ok: false, error: 'Please correct the highlighted fields.', fields: errors }, 422);

  if (!env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not configured');
    return json({ ok: false, error: 'The enquiry service is not configured yet. Please email or call us directly.' }, 500);
  }

  const meta = { when: new Date().toISOString(), origin: request.headers.get('Origin') || new URL(request.url).origin, ip };
  const { text, html } = buildEmail(data, meta);

  let resp;
  try {
    resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.FROM_EMAIL || 'KVK Website <onboarding@resend.dev>',
        to: [env.TO_EMAIL || DEFAULT_TO],
        reply_to: data.email,
        subject: SUBJECT,
        text,
        html,
      }),
    });
  } catch (e) {
    console.error('Email provider unreachable', e && e.message);
    return json({ ok: false, error: 'We could not send your enquiry right now. Please try again, or email/call us directly.' }, 502);
  }
  if (!resp.ok) {
    console.error('Email provider rejected request', resp.status, (await resp.text()).slice(0, 300));
    return json({ ok: false, error: 'We could not send your enquiry right now. Please try again, or email/call us directly.' }, 502);
  }

  // Optional D1 storage: best-effort, never blocks or fails a delivered enquiry.
  const store = saveEnquiry(env, data, meta).catch((e) => console.error('D1 save failed', e && e.message));
  if (context.waitUntil) context.waitUntil(store);

  return json({ ok: true, message: 'Thank you! Your enquiry has been sent. We will get back to you shortly.' });
}

export async function onRequest() {
  return json({ ok: false, error: 'Method not allowed.' }, 405, { Allow: 'POST' });
}
