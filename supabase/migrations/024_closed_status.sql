-- ALTER TYPE ... ADD VALUE cannot run inside a transaction.
-- These statements commit immediately and are idempotent.

ALTER TYPE public.publication_status ADD VALUE IF NOT EXISTS 'closed';
ALTER TYPE public.audit_action       ADD VALUE IF NOT EXISTS 'activity.closed';
