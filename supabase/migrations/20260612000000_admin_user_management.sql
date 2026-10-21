-- Migration: admin user management support
-- Allows admins to read all profiles (needed for the Users management page)
-- Allows admins to update any profile (to set institution_id for staff)
-- Allows admins to manage user_roles for all users

-- Profiles: admin can read all profiles
CREATE POLICY "admin reads all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Profiles: admin can update any profile (e.g. setting institution_id for agents)
CREATE POLICY "admin updates any profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- User roles: admin can insert roles for any user
CREATE POLICY "admin inserts user roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- User roles: admin can delete roles for any user
CREATE POLICY "admin deletes user roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- User roles: admin can read all roles (needed to display role on Users page)
CREATE POLICY "admin reads all user roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
  );

-- Drop the old narrow policy that only let users see their own role
-- (replaced by the combined policy above)
DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
