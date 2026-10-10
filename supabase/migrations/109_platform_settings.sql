-- Migration 109: platform-wide settings (owned by the Creche Wise platform, not a
-- crèche). First use: Creche Wise's own social media links (keys `social_<network>`),
-- shown in the footer of the platform's public pages. Edited by the platform owner
-- in /platform/settings via the service-role client. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.platform_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_platform_settings_updated_at ON public.platform_settings;
CREATE TRIGGER trg_platform_settings_updated_at
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Service-role only: no policies for anon/authenticated, so only the server reads/writes.
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_settings TO service_role;
