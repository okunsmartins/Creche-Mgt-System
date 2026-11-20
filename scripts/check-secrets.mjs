#!/usr/bin/env node
// Blocks a commit that adds a live-looking secret (API key, webhook secret, private key).
// Runs from .githooks/pre-commit. Free stand-in for GitHub push protection, which isn't
// available on private repos without a paid plan.
//
//   node scripts/check-secrets.mjs            # scan staged changes (what the hook does)
//   node scripts/check-secrets.mjs --self-test
//
// Only ADDED lines are scanned, so existing files never trip it. To allow a deliberate
// fake value in a test, put `secret-scan: allow` on the same line.

import { execFileSync } from 'node:child_process'

export const PATTERNS = [
  ['Stripe secret / restricted key', /\b(?:sk|rk)_(?:live|test)_[0-9A-Za-z]{20,}/],
  ['Stripe webhook secret', /\bwhsec_[0-9A-Za-z]{20,}/],
  ['Revolut API key', /\br_(?:prod|test)_[0-9A-Za-z_-]{20,}/],
  ['Resend API key', /\bre_[0-9A-Za-z]{8,}_[0-9A-Za-z]{16,}/],
  ['Twilio Account SID', /\bAC[0-9a-f]{32}\b/],
  ['Twilio API key SID', /\bSK[0-9a-f]{32}\b/],
  ['Supabase secret key', /\bsb_secret_[0-9A-Za-z_-]{20,}/],
  [
    'Supabase service-role JWT',
    /\beyJ[0-9A-Za-z_-]{10,}\.eyJ[0-9A-Za-z_-]*c2VydmljZV9yb2xl[0-9A-Za-z_-]*\.[0-9A-Za-z_-]{10,}/,
  ],
  ['Private key block', /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/],
]

const ALLOW = 'secret-scan: allow'
// Never scanned: lockfiles and binary-ish assets.
const SKIP_FILE = /(?:^|\/)(?:package-lock\.json|.*\.(?:png|jpe?g|gif|webp|ico|pdf|woff2?))$/

/** Findings in a unified diff (only `+` lines of non-skipped files). */
export function scanDiff(diff) {
  const findings = []
  let file = ''
  let line = 0
  for (const raw of diff.split('\n')) {
    if (raw.startsWith('+++ ')) {
      file = raw.slice(4).replace(/^b\//, '')
      continue
    }
    const hunk = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)/)
    if (hunk) {
      line = Number(hunk[1]) - 1
      continue
    }
    if (raw.startsWith('+')) {
      line++
      if (SKIP_FILE.test(file) || raw.includes(ALLOW)) continue
      for (const [name, re] of PATTERNS) {
        if (re.test(raw)) findings.push({ file, line, name })
      }
    } else if (!raw.startsWith('-')) {
      line++
    }
  }
  return findings
}

function selfTest() {
  const fake = (s) => s.split('|').join('') // keep this file itself free of matches
  const diff = [
    '+++ b/src/a.ts',
    '@@ -0,0 +1,4 @@',
    `+const k = '${fake('sk_live_|aaaaaaaaaaaaaaaaaaaaaaaa')}'`,
    `+const ok = 'sk_test_short'`,
    `+const t = '${fake('whsec_|bbbbbbbbbbbbbbbbbbbbbbbb')}' // ${ALLOW}`,
    `+const sid = '${fake('AC|0123456789abcdef0123456789abcdef')}'`,
    '+++ b/package-lock.json',
    '@@ -0,0 +1,1 @@',
    `+"x": "${fake('sk_live_|cccccccccccccccccccccccc')}"`,
  ].join('\n')
  const got = scanDiff(diff).map((f) => `${f.file}:${f.line}:${f.name}`)
  const want = ['src/a.ts:1:Stripe secret / restricted key', 'src/a.ts:4:Twilio Account SID']
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    console.error('self-test FAILED\n got:', got, '\nwant:', want)
    process.exit(1)
  }
  console.log('check-secrets self-test passed')
}

if (process.argv.includes('--self-test')) {
  selfTest()
} else {
  const diff = execFileSync('git', ['diff', '--cached', '-U0', '--no-color'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  const findings = scanDiff(diff)
  if (findings.length > 0) {
    console.error('\n✋ Commit blocked: this looks like a secret.\n')
    for (const f of findings) console.error(`  ${f.file}:${f.line}  ${f.name}`)
    console.error(
      `\nKeep keys in .env.local (git-ignored) or Vercel, never in the repo.\n` +
        `If it's a deliberate fake for a test, add "${ALLOW}" on that line.\n`,
    )
    process.exit(1)
  }
}
