
-- Fix: RLS policy "update appt" allowed citizens to modify ANY column
-- on their own pending appointments (queue_number, service_id,
-- full_name, appointment_date, etc.) — not just cancel.
--
-- Root cause: the WITH CHECK clause for self-owned rows only verified
-- user_id = auth.uid() with no column or status restriction.
--
-- Fix: Remove direct UPDATE access for self-owned rows entirely.
-- Citizens must call cancel_own_appointment() RPC instead, which
-- is a SECURITY DEFINER function that ONLY sets status = 'cancelled'.

-- 1. Drop the overly permissive policy
DROP POLICY IF EXISTS "update appt" ON public.appointments;

-- 2. Re-create without self-user access (admins and agents only)
CREATE POLICY "update appt" ON public.appointments
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(),'admin')
    OR (public.has_role(auth.uid(),'agent') AND institution_id = public.user_institution(auth.uid()))
  ) WITH CHECK (
    public.has_role(auth.uid(),'admin')
    OR (public.has_role(auth.uid(),'agent') AND institution_id = public.user_institution(auth.uid()))
  );

-- 3. Create a dedicated cancellation function for citizens
--    SECURITY DEFINER so it runs with owner privileges (bypasses RLS).
--    Only allows setting status = 'cancelled' — no other column changes.
CREATE OR REPLACE FUNCTION public.cancel_own_appointment(_appointment_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user_id uuid;
  _status  public.appointment_status;
BEGIN
  SELECT a.user_id, a.status INTO _user_id, _status
    FROM public.appointments a
   WHERE a.id = _appointment_id;

  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;

  IF _user_id <> auth.uid() THEN
    RAISE EXCEPTION 'You can only cancel your own appointments';
  END IF;

  IF _status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending appointments can be cancelled';
  END IF;

  UPDATE public.appointments
     SET status = 'cancelled'
   WHERE id       = _appointment_id
     AND user_id  = auth.uid()
     AND status   = 'pending';
END $$;

GRANT EXECUTE ON FUNCTION public.cancel_own_appointment(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_own_appointment(uuid) FROM anon;
