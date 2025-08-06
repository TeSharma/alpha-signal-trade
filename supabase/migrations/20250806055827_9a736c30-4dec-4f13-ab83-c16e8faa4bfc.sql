-- Fix RLS policy issue for Sharma table (add basic policy)
CREATE POLICY "Allow public read access to Sharma" 
ON public.Sharma 
FOR SELECT 
USING (true);

-- No immediate fix needed for leaked password protection - that's a Supabase auth setting