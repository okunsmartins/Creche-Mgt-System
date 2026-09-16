-- =============================================================================
-- Migration 039: Drop redundant index on subscriptions.school_id
-- =============================================================================
-- Phase 1 review finding: migration 038 added both `UNIQUE (school_id)` and a
-- separate `idx_subscriptions_school_id`. The UNIQUE constraint already creates a
-- unique B-tree index on school_id, so the extra index is fully redundant (it only
-- adds write/storage overhead). Drop it. The unique constraint's own index remains
-- and serves all school_id lookups.
DROP INDEX IF EXISTS public.idx_subscriptions_school_id;
