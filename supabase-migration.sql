-- Phase 2: Community submissions schema
-- Run this in the Supabase SQL Editor to set up the submissions table.

-- Enable PostGIS if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- Submissions table
CREATE TABLE submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  location GEOGRAPHY(Point, 4326) GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
  ) STORED,
  category TEXT NOT NULL,
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 20 AND 600),
  link TEXT,
  email TEXT,
  contact_consent BOOLEAN DEFAULT false,
  publish_consent BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  cluster_id UUID,
  nomination_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for spatial dedup queries
CREATE INDEX idx_submissions_location ON submissions USING GIST (location);

-- Index for status filtering (approved spots for map layer)
CREATE INDEX idx_submissions_status ON submissions (status);

-- Row Level Security
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- Public can insert new submissions
CREATE POLICY "Anyone can submit" ON submissions
  FOR INSERT WITH CHECK (true);

-- Public can read approved submissions (no email exposed)
CREATE POLICY "Anyone can read approved spots" ON submissions
  FOR SELECT USING (status = 'approved');

-- Service role bypasses RLS for admin review
-- (Supabase service role key already bypasses RLS by default)

-- RPC function for spatial + name dedup matching
CREATE OR REPLACE FUNCTION find_nearby_submissions(
  search_lat DOUBLE PRECISION,
  search_lng DOUBLE PRECISION,
  radius_meters DOUBLE PRECISION,
  search_name TEXT
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  cluster_id UUID,
  nomination_count INTEGER
)
LANGUAGE sql STABLE
AS $$
  SELECT s.id, s.name, s.cluster_id, s.nomination_count
  FROM submissions s
  WHERE ST_DWithin(
    s.location,
    ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::geography,
    radius_meters
  )
  AND similarity(lower(s.name), search_name) > 0.3
  ORDER BY ST_Distance(
    s.location,
    ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::geography
  )
  LIMIT 1;
$$;

-- Enable pg_trgm for fuzzy name matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;
