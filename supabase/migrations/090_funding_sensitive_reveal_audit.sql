-- =============================================================================
-- Migration 090: Funding & Hive Centre — audit actions for sensitive-identifier reveal
-- =============================================================================
-- Additive. PPSN (encrypted) and CHICK are masked by default in the funding UI; a
-- controlled reveal is gated behind funding.view_sensitive_identifiers (ungranted by
-- default) and every reveal is AUDITED. These enum values are what the app's audit()
-- helper writes on a reveal (mirror migrations 022/028/088). The new values are not used
-- elsewhere in this migration, so it is transaction-safe.
--
-- ⚠️ Apply to the REAL production project (ref xpbavfutfejlfbmnntyl).

ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'funding.ppsn_revealed';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'funding.chick_revealed';
