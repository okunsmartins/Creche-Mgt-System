-- Add deposit_receipt to the email_type enum for installment deposit notifications.
ALTER TYPE public.email_type ADD VALUE IF NOT EXISTS 'deposit_receipt';
