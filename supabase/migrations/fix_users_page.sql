-- Fix: Missing get_all_users RPC for the Users admin page
-- This function allows admins to securely fetch all users including auth details,
-- profiles, their highest role, and assigned institution.

CREATE OR REPLACE FUNCTION public.get_all_users()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  role text,
  institution_id uuid,
  institution_name text
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Security check: only admins can fetch all users
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied. Admins only.';
  END IF;

  RETURN QUERY
  SELECT 
    au.id,
    au.email::text,
    p.full_name,
    COALESCE(
      (
        SELECT ur.role 
        FROM public.user_roles ur 
        WHERE ur.user_id = au.id 
        ORDER BY 
          CASE ur.role 
            WHEN 'admin' THEN 1 
            WHEN 'agent' THEN 2 
            WHEN 'citizen' THEN 3
            ELSE 4 
          END 
        LIMIT 1
      ), 
      'citizen'
    ) AS role,
    p.institution_id,
    i.name AS institution_name
  FROM auth.users au
  LEFT JOIN public.profiles p ON p.id = au.id
  LEFT JOIN public.institutions i ON i.id = p.institution_id;
END;
$$;

-- Grant execution to authenticated users (the function itself enforces the admin check)
GRANT EXECUTE ON FUNCTION public.get_all_users() TO authenticated;
