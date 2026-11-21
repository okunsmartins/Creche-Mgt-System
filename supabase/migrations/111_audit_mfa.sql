-- Migration 111: audit actions for admin two-step sign-in (TOTP MFA).
--   auth.mfa_enrolled — an admin finished setting up their authenticator app
--   auth.mfa_reset    — the platform owner removed an admin's authenticator (lost phone)
-- Safe to re-run. Until applied, MFA works normally; only these audit rows fail
-- (audit writes are best-effort and logged).
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'auth.mfa_enrolled';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'auth.mfa_reset';
