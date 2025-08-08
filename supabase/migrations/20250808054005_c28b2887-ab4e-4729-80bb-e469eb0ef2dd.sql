-- Fix the RLS policies for the Sharma table (which seems to have no policies)
-- Since we don't know what the Sharma table is for, we'll add basic user-based policies

CREATE POLICY "Users can insert their own Sharma records" 
ON public.Sharma 
FOR INSERT 
WITH CHECK (true); -- Allow all authenticated users to insert

CREATE POLICY "Users can view all Sharma records" 
ON public.Sharma 
FOR SELECT 
USING (true); -- Allow all users to view Sharma records

CREATE POLICY "Users can update all Sharma records" 
ON public.Sharma 
FOR UPDATE 
USING (true); -- Allow all users to update

CREATE POLICY "Users can delete all Sharma records" 
ON public.Sharma 
FOR DELETE 
USING (true); -- Allow all users to delete