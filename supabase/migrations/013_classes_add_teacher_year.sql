-- =============================================================================
-- Migration 013: Add teacher_id and academic_year to classes
-- =============================================================================
-- teacher_id is nullable; a class may exist before a teacher is assigned.
-- ON DELETE SET NULL ensures removing a teacher record does not cascade-delete classes.
-- academic_year is a free-text label (e.g. '2025-2026').

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS teacher_id    UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS academic_year TEXT;

CREATE INDEX idx_classes_teacher_id ON public.classes(teacher_id);
