-- =====================================================================
-- SmartFace Attendance Management System - Database Migration
-- Target: PostgreSQL / Supabase
-- Version: 1.0.0
-- =====================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES & ROLES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'manager', 'auditor')),
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. WORK SCHEDULES & SHIFTS
CREATE TABLE IF NOT EXISTS public.schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    work_start_time TIME NOT NULL DEFAULT '09:00:00',
    work_end_time TIME NOT NULL DEFAULT '18:00:00',
    grace_period_minutes INTEGER NOT NULL DEFAULT 15,
    half_day_threshold_minutes INTEGER NOT NULL DEFAULT 240, -- 4 hours minimum
    overtime_threshold_minutes INTEGER NOT NULL DEFAULT 480, -- 8 hours minimum
    work_days INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}', -- 1=Monday, 7=Sunday
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PEOPLE (EMPLOYEES, STUDENTS, CONTRACTORS)
CREATE TABLE IF NOT EXISTS public.people (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    person_id TEXT UNIQUE NOT NULL, -- Unique Badge / Employee ID (e.g., SF-1001)
    full_name TEXT NOT NULL,
    department TEXT NOT NULL,
    designation TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    enrollment_status TEXT NOT NULL DEFAULT 'not_enrolled' CHECK (enrollment_status IN ('not_enrolled', 'pending_approval', 'enrolled', 'rejected')),
    consent_status TEXT NOT NULL DEFAULT 'granted' CHECK (consent_status IN ('granted', 'withheld', 'revoked')),
    consent_date TIMESTAMPTZ DEFAULT NOW(),
    avatar_url TEXT,
    schedule_id UUID REFERENCES public.schedules(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for rapid badge lookup
CREATE INDEX IF NOT EXISTS idx_people_person_id ON public.people(person_id);
CREATE INDEX IF NOT EXISTS idx_people_department ON public.people(department);
CREATE INDEX IF NOT EXISTS idx_people_status ON public.people(status);

-- 4. CAMERA DEVICES REGISTRY (ESP32-CAM & Hardware Terminals)
CREATE TABLE IF NOT EXISTS public.camera_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id TEXT UNIQUE NOT NULL, -- e.g. "CAM-MAIN-ENTRANCE-01"
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    direction TEXT NOT NULL DEFAULT 'entry' CHECK (direction IN ('entry', 'exit', 'bidirectional')),
    status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'warning', 'maintenance')),
    ip_address TEXT,
    mac_address TEXT,
    firmware_version TEXT DEFAULT 'v1.0.4-esp32',
    auth_token_hash TEXT NOT NULL,
    last_heartbeat_at TIMESTAMPTZ,
    last_event_at TIMESTAMPTZ,
    is_simulated BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devices_device_id ON public.camera_devices(device_id);

-- 5. ATTENDANCE EVENTS (Immutable raw capture log)
CREATE TABLE IF NOT EXISTS public.attendance_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
    device_id UUID REFERENCES public.camera_devices(id) ON DELETE SET NULL,
    event_timestamp TIMESTAMPTZ NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('entry', 'exit', 'unspecified')),
    confidence_score NUMERIC(5,4) CHECK (confidence_score >= 0 AND confidence_score <= 1.0),
    snapshot_url TEXT,
    is_duplicate BOOLEAN NOT NULL DEFAULT FALSE,
    source TEXT NOT NULL DEFAULT 'camera' CHECK (source IN ('camera', 'manual_entry', 'simulator', 'api')),
    raw_payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Composite index for duplicate event detection and range queries
CREATE INDEX IF NOT EXISTS idx_events_person_time ON public.attendance_events(person_id, event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON public.attendance_events(event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_device ON public.attendance_events(device_id);

-- 6. DAILY ATTENDANCE SUMMARIES (Derived, cached daily status)
CREATE TABLE IF NOT EXISTS public.daily_attendance_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    schedule_id UUID REFERENCES public.schedules(id) ON DELETE SET NULL,
    first_in TIMESTAMPTZ,
    last_out TIMESTAMPTZ,
    total_work_minutes INTEGER NOT NULL DEFAULT 0,
    late_minutes INTEGER NOT NULL DEFAULT 0,
    early_leave_minutes INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('present', 'late', 'half_day', 'absent', 'holiday', 'leave')),
    is_manually_adjusted BOOLEAN NOT NULL DEFAULT FALSE,
    adjustment_reason TEXT,
    adjusted_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_person_date UNIQUE (person_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_date ON public.daily_attendance_summaries(date);
CREATE INDEX IF NOT EXISTS idx_daily_status ON public.daily_attendance_summaries(status);

-- 7. ENROLLMENT RECORDS (Face Photos and Vector Metadata)
CREATE TABLE IF NOT EXISTS public.enrollment_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    photo_angle TEXT NOT NULL CHECK (photo_angle IN ('front', 'left_30', 'right_30')),
    quality_score NUMERIC(5,2) DEFAULT 0.0,
    bounding_box JSONB, -- { x, y, width, height }
    template_status TEXT NOT NULL DEFAULT 'pending' CHECK (template_status IN ('pending', 'extracted', 'failed')),
    vector_id TEXT, -- ID in separate vector DB/recognition service
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. HOLIDAYS
CREATE TABLE IF NOT EXISTS public.holidays (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    date DATE NOT NULL UNIQUE,
    is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. LEAVE REQUESTS
CREATE TABLE IF NOT EXISTS public.leave_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
    leave_type TEXT NOT NULL CHECK (leave_type IN ('annual', 'sick', 'casual', 'unpaid')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
    reason TEXT NOT NULL,
    approved_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. AUDIT LOGS (Immutable tracking)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_email TEXT NOT NULL,
    user_role TEXT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_created_at ON public.audit_logs(created_at DESC);

-- 11. SYSTEM SETTINGS
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_attendance_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camera_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated reads for administrative roles
CREATE POLICY "Authenticated users can read people" ON public.people FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can read events" ON public.attendance_events FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can read daily summaries" ON public.daily_attendance_summaries FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can read devices" ON public.camera_devices FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can read logs" ON public.audit_logs FOR SELECT USING (auth.role() = 'authenticated');

-- Service role has full permissions for automated calculations & hardware APIs
-- (Enforced automatically by Supabase Service Role Key)
