-- Supabase Schema for WebXR Exhibit Tour Data
-- Copy and paste this into the Supabase SQL Editor and click RUN.

CREATE TABLE IF NOT EXISTS public.tours (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    subtitle TEXT,
    category TEXT,
    thumbnail TEXT,
    description TEXT,
    "videoSrc" TEXT,
    duration INTEGER DEFAULT 120,
    hotspots JSONB DEFAULT '[]'::jsonb
);

-- Optional: Enable Row Level Security (RLS) if you want to make it read-only for public
-- and write-only for admins. For a simple prototype, you can leave RLS disabled or 
-- allow all anon access as below.

-- Enable RLS
ALTER TABLE public.tours ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access" ON public.tours
    FOR SELECT USING (true);

-- Allow public insert/update access (for the admin dashboard without auth)
CREATE POLICY "Allow public insert and update" ON public.tours
    FOR ALL USING (true) WITH CHECK (true);
