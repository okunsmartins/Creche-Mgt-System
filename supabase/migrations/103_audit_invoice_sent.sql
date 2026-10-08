-- ============================================================================
-- Migration 103: audit action for "invoice sent to parent" (Fees Due feature)
-- ============================================================================
-- Admins can email a parent a link to view/pay an outstanding invoice from the
-- Fees Due page. Record that send in the audit trail. ADD VALUE is idempotent.
--
-- ⚠️ Apply to the REAL production project (ref xpbavfutfejlfbmnntyl).

ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'invoice.sent';
