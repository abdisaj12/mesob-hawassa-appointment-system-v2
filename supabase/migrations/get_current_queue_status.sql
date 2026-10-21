-- Feature: Live Queue Tracking
-- Secure RPC to get the highest queue number currently processed (served or no_show)
-- for a specific service on a given date and window. This exposes no PII.

CREATE OR REPLACE FUNCTION public.get_current_queue_status(
  _institution_id uuid,
  _service_id uuid,
  _date date,
  _window public.appointment_window
) RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(MAX(queue_number), 0)
  FROM public.appointments
  WHERE institution_id = _institution_id
    AND service_id = _service_id
    AND appointment_date = _date
    AND slot_window = _window
    AND status IN ('served', 'no_show');
$$;

-- Allow anyone to check the queue status for the public dashboard
GRANT EXECUTE ON FUNCTION public.get_current_queue_status(uuid, uuid, date, public.appointment_window) TO anon, authenticated;
