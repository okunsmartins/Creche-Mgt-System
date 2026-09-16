-- =============================================================================
-- Migration 011: Extend verification_status enum to match SRS §9.2
-- =============================================================================
-- SRS §9.2 specifies: VERIFIED_LINK, VERIFIED_CODE, MANUAL_REVIEW, MANUALLY_MATCHED
-- The original enum used collapsed values ('verified', 'manual', 'unverified').
-- This migration adds the spec-compliant values without removing the legacy ones
-- (PostgreSQL does not support removing enum values without recreating the type).
-- New code uses the spec values; old values remain for any existing rows.

ALTER TYPE public.verification_status ADD VALUE IF NOT EXISTS 'verified_link';
ALTER TYPE public.verification_status ADD VALUE IF NOT EXISTS 'verified_code';
ALTER TYPE public.verification_status ADD VALUE IF NOT EXISTS 'manual_review';
ALTER TYPE public.verification_status ADD VALUE IF NOT EXISTS 'manually_matched';
