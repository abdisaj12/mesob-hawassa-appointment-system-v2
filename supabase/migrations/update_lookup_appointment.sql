-- Update lookup_appointment to return institution_id and service_id for realtime tracking

DROP FUNCTION IF EXISTS public.lookup_appointment(text);

CREATE OR REPLACE FUNCTION public.lookup_appointment(_ref text)
RETURNS TABLE(
  reference text,
  full_name text,
  appointment_date date,
  slot_window public.appointment_window,
  queue_number int,
  status public.appointment_status,
  institution_name text,
  service_name text,
  institution_id uuid,
  service_id uuid
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.reference, a.full_name, a.appointment_date, a.slot_window, a.queue_number,
         a.status, i.name, s.name, a.institution_id, a.service_id
    FROM public.appointments a
    JOIN public.institutions i ON i.id = a.institution_id
    JOIN public.services s ON s.id = a.service_id
    WHERE a.reference = _ref
$$;

GRANT EXECUTE ON FUNCTION public.lookup_appointment(text) TO anon, authenticated;
