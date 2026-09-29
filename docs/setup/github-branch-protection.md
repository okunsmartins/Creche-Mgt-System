# GitHub Branch Protection — Setup Checklist

**Why:** PR #1 merged into `main` with a **failing CI check** because `main` had no
protection rule. This checklist prevents that. Do it once, in the GitHub UI.

Repo: `okunsmartins/Creche-Mgt-System` → **Settings → Branches → Add branch ruleset**
(or **Add classic branch protection rule**). Modern GitHub calls these **Rulesets**; the
classic UI calls them **Branch protection rules**. Either works — steps below cover both.

---

## 1. Protect `main`
- [ ] Target branch pattern: `main` (add `develop`/release branches later if used).
- [ ] **Require a pull request before merging** — no direct pushes to `main`.
  - [ ] Require **at least 1 approval** (solo for now? set to 0 approvals but keep the PR + status-check gates, or approve your own via a second account later).
  - [ ] **Dismiss stale approvals** when new commits are pushed.
- [ ] **Require status checks to pass before merging** — this is the one that would have caught PR #1:
  - [ ] Turn on **Require branches to be up to date before merging**.
  - [ ] Select these required checks (they appear after CI has run at least once):
    - [ ] **Lint & Type Check**
    - [ ] **Unit Tests**
    - [ ] **Production Build**
    - [ ] **E2E Tests** *(only once E2E is actually wired to run — until then, leave it optional so it can't block, or mark it not-required)*
- [ ] **Require conversation resolution before merging.**
- [ ] **Do not allow bypassing the above settings** (uncheck "allow administrators to bypass", or in Rulesets leave the bypass list empty) — otherwise you can still merge red, which is what happened.
- [ ] **Block force pushes** to `main`.
- [ ] **Restrict deletions** of `main`.

## 2. Secret scanning + push protection
- [ ] **Settings → Code security and analysis:**
  - [ ] Enable **Secret scanning**.
  - [ ] Enable **Push protection** (this is what blocked the Twilio SID push — keep it on).
  - [ ] Enable **Dependabot alerts** + **Dependabot security updates**.
- [ ] Never use the "allow secret" bypass link for a **real** secret — redact from history and rotate instead (see `docs/implementation-status.md` security section).

## 3. Merge hygiene
- [ ] **Settings → General → Pull Requests:**
  - [ ] Prefer **Squash merging** (keeps `main` history clean; the 16-commit feature history stays on the PR).
  - [ ] **Automatically delete head branches** after merge.

## 4. Verify it works
- [ ] Open a throwaway PR with a deliberate lint error → confirm the **merge button is blocked** until checks pass.
- [ ] Confirm you **cannot** push directly to `main` (`git push origin main` from a dirty branch is rejected).

---

## Local pre-flight (run before every PR so CI can't surprise you)
CI's "Lint & Type Check" job runs **four** gates — miss any and the PR goes red:

```bash
npm run type-check     # tsc --noEmit
npm run lint           # eslint src
npm run format:check   # prettier --check .   ← the one PR #1 missed
npm run test -- run    # vitest (749 tests)
# auto-fix formatting before committing:
npm run format         # prettier --write .
```
