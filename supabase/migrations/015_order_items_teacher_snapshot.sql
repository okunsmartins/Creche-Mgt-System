-- =============================================================================
-- Migration 015: Add teacher_name_snapshot to order_items
-- =============================================================================
-- Nullable because orders created before teacher assignment (or for activities
-- without an assigned teacher) carry no teacher snapshot.
-- The snapshot is locked at order creation — subsequent teacher renames do
-- not affect historical records.

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS teacher_name_snapshot TEXT;
