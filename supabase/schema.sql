-- =====================================================================
-- TeamCodeLocked & BitByBit Certificate Portal - Database Schema
-- Supabase PostgreSQL
-- =====================================================================

-- 1. Create Certificates Table
CREATE TABLE IF NOT EXISTS public.certificates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('participant', 'volunteer')) DEFAULT 'participant',
  file_url TEXT NOT NULL,
  certificate_url TEXT,
  filename TEXT,
  organization TEXT DEFAULT 'TeamCodeLocked',
  college TEXT DEFAULT 'B.M.S. College of Engineering',
  event TEXT DEFAULT 'Club Orientation 2026',
  partner TEXT DEFAULT 'BitByBit',
  partner_url TEXT DEFAULT 'https://bitbybit-9h8e.vercel.app',
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMPTZ,
  email_count INTEGER DEFAULT 0,
  last_sent_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Indexes for High-Speed Queries
CREATE INDEX IF NOT EXISTS idx_certificates_email ON public.certificates (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_certificates_type ON public.certificates (type);
CREATE INDEX IF NOT EXISTS idx_certificates_created_at ON public.certificates (created_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

-- 4. Policies:
-- Allow everyone (public visitors) to search and read certificates
DROP POLICY IF EXISTS "Public can view certificates" ON public.certificates;
CREATE POLICY "Public can view certificates"
  ON public.certificates
  FOR SELECT
  TO public
  USING (true);

-- Allow service role full write access (used securely by Next.js API with SUPABASE_SERVICE_ROLE_KEY)
DROP POLICY IF EXISTS "Service role full access" ON public.certificates;
CREATE POLICY "Service role full access"
  ON public.certificates
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
