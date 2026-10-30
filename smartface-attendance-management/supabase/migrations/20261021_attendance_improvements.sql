-- =====================================================================
-- SmartFace Attendance Management System - Enhancements Migration
-- Target: PostgreSQL / Supabase
-- Version: 1.1.0
-- Adds: Idempotent client request IDs, simulated event isolation,
-- timezone columns, biometric consent audit timestamps.
-- =====================================================================

-- 1. Add client_request_id and is_simulated to attendance_events
ALTER TABLE IF EXISTS public.attendance_events
ADD COLUMN IF NOT EXISTS client_request_id TEXT,
ADD COLUMN IF NOT EXISTS is_simulated BOOLEAN NOT NULL DEFAULT FALSE;

-- Ensure idempotency index for event deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_client_request_id 
ON public.attendance_events(client_request_id) 
WHERE client_request_id IS NOT NULL;

-- 2. Add biometric consent revocation & retention fields to people
ALTER TABLE IF EXISTS public.people
ADD COLUMN IF NOT EXISTS biometric_consent_revoked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS retention_policy TEXT DEFAULT 'tenure_plus_30_days';

-- 3. Add explicit timezone to schedules
ALTER TABLE IF EXISTS public.schedules
ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata';

-- 4. Add punch_sessions JSONB to daily_attendance_summaries for multiple in/out tracking
ALTER TABLE IF EXISTS public.daily_attendance_summaries
ADD COLUMN IF NOT EXISTS punch_sessions JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS is_simulated BOOLEAN NOT NULL DEFAULT FALSE;

-- 5. Session tokens table for server-side auth
CREATE TABLE IF NOT EXISTS public.auth_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token TEXT UNIQUE NOT NULL,
    user_email TEXT NOT NULL,
    user_role TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_token ON public.auth_sessions(token);
