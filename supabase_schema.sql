-- ============================================================================
-- TBM PLANNER: SUPABASE DATABASE SCHEMA (100% FREE TIER READY)
-- MRT Purple Line Project / MWA-9D TBM#34
-- ============================================================================

-- 1. Create table for Ring Logs & Drive History
CREATE TABLE IF NOT EXISTS public.ring_logs (
    id BIGSERIAL PRIMARY KEY,
    ring_number INT NOT NULL UNIQUE,
    ring_num_str TEXT,
    sta TEXT,
    dist NUMERIC,
    section_code TEXT,
    key_position TEXT NOT NULL,
    prev_key TEXT,
    segment_type TEXT NOT NULL, -- 'U' | 'R' | 'L'
    segment_size INT DEFAULT 1200, -- 1200 or 1400 mm
    h_lead NUMERIC DEFAULT 0,
    v_plumb NUMERIC DEFAULT 0,
    lead_req NUMERIC DEFAULT 0,
    after_h NUMERIC DEFAULT 0,
    after_v NUMERIC DEFAULT 0,
    deviation_mm NUMERIC DEFAULT 0,
    suitability TEXT DEFAULT 'Yes',
    gap_top NUMERIC DEFAULT 90,
    gap_bottom NUMERIC DEFAULT 90,
    gap_left NUMERIC DEFAULT 90,
    gap_right NUMERIC DEFAULT 90,
    roll NUMERIC DEFAULT 0,
    pitch NUMERIC DEFAULT 0,
    yaw NUMERIC DEFAULT 0,
    thrust_force NUMERIC DEFAULT 0,
    torque NUMERIC DEFAULT 0,
    excavation_date TIMESTAMPTZ DEFAULT NOW(),
    operator_name TEXT DEFAULT 'Chief Engineer',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create table for Horizontal Alignment Sections
CREATE TABLE IF NOT EXISTS public.horizontal_alignment (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    section_type TEXT NOT NULL, -- 'full_curve' | 'transition_in' | 'transition_out' | 'tangent'
    direction TEXT NOT NULL, -- 'right' | 'left' | 'straight'
    start_sta TEXT NOT NULL,
    end_sta TEXT NOT NULL,
    radius NUMERIC DEFAULT 180,
    ratio JSONB DEFAULT '{"un": 1, "rt": 1, "lt": 1}'::jsonb,
    allowed_types JSONB DEFAULT '["U", "R", "L"]'::jsonb,
    sequence_order INT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create table for Vertical Alignment Profile (VPI)
CREATE TABLE IF NOT EXISTS public.vertical_alignment (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    start_sta TEXT NOT NULL,
    end_sta TEXT NOT NULL,
    start_elev NUMERIC DEFAULT 0,
    end_elev NUMERIC DEFAULT 0,
    grade_pct NUMERIC DEFAULT 0,
    curve_type TEXT DEFAULT 'constant_grade', -- 'constant_grade' | 'sag_curve' | 'crest_curve'
    radius_v NUMERIC DEFAULT 0,
    length_v NUMERIC DEFAULT 0,
    sequence_order INT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create table for Consumables & Polymer Logs
CREATE TABLE IF NOT EXISTS public.consumables_logs (
    id BIGSERIAL PRIMARY KEY,
    ring_number INT NOT NULL,
    foam_liters NUMERIC DEFAULT 0,
    polymer_kg NUMERIC DEFAULT 0,
    bentonite_m3 NUMERIC DEFAULT 0,
    grout_liters NUMERIC DEFAULT 0,
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.ring_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horizontal_alignment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vertical_alignment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consumables_logs ENABLE ROW LEVEL SECURITY;

-- 6. Create Public Access Policies (Allow Read/Write with Anon Key)
CREATE POLICY "Allow public read ring_logs" ON public.ring_logs FOR SELECT USING (true);
CREATE POLICY "Allow public insert ring_logs" ON public.ring_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update ring_logs" ON public.ring_logs FOR UPDATE USING (true);
CREATE POLICY "Allow public delete ring_logs" ON public.ring_logs FOR DELETE USING (true);

CREATE POLICY "Allow public read horizontal_alignment" ON public.horizontal_alignment FOR SELECT USING (true);
CREATE POLICY "Allow public all horizontal_alignment" ON public.horizontal_alignment FOR ALL USING (true);

CREATE POLICY "Allow public read vertical_alignment" ON public.vertical_alignment FOR SELECT USING (true);
CREATE POLICY "Allow public all vertical_alignment" ON public.vertical_alignment FOR ALL USING (true);

CREATE POLICY "Allow public read consumables_logs" ON public.consumables_logs FOR SELECT USING (true);
CREATE POLICY "Allow public all consumables_logs" ON public.consumables_logs FOR ALL USING (true);

-- 7. Enable Realtime Publications for Live Syncing across all devices!
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE 
    public.ring_logs, 
    public.horizontal_alignment, 
    public.vertical_alignment;
COMMIT;

-- 8. Insert Default Horizontal Alignment Data (MRT Purple Line Project)
INSERT INTO public.horizontal_alignment (id, code, name, section_type, direction, start_sta, end_sta, radius, ratio, allowed_types, sequence_order)
VALUES 
  ('sec-1', '12"', 'Transition In (Right)', 'transition_in', 'right', '20+272.724', '20+222.724', 180, '{"un": 0, "rt": 23, "lt": 13}'::jsonb, '["R", "L"]'::jsonb, 1),
  ('sec-2', '13', 'Full Curve (Right)', 'full_curve', 'right', '20+222.724', '20+133.511', 180, '{"un": 3, "rt": 1, "lt": 0}'::jsonb, '["U", "R"]'::jsonb, 2),
  ('sec-3', '13A', 'Transition Out (Right)', 'transition_out', 'right', '20+133.511', '20+083.511', 180, '{"un": 0, "rt": 23, "lt": 13}'::jsonb, '["R", "L"]'::jsonb, 3)
ON CONFLICT (id) DO NOTHING;

-- 9. Insert Default Vertical Alignment Data (MRT Purple Line Project)
INSERT INTO public.vertical_alignment (id, code, name, start_sta, end_sta, start_elev, end_elev, grade_pct, curve_type, radius_v, length_v, sequence_order)
VALUES
  ('vpi-1', 'VPI-01', 'Entry Grade (-1.2%)', '20+272.724', '20+200.000', 12.500, 11.628, -1.20, 'constant_grade', 0, 72.724, 1),
  ('vpi-2', 'VPI-02', 'Sag Curve (VPI STA 20+180)', '20+200.000', '20+140.000', 11.628, 11.450, -0.30, 'sag_curve', 2500, 60.000, 2),
  ('vpi-3', 'VPI-03', 'Exit Grade (+0.85%)', '20+140.000', '20+083.511', 11.450, 11.930, 0.85, 'constant_grade', 0, 56.489, 3)
ON CONFLICT (id) DO NOTHING;
