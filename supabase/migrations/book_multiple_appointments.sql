-- Fix: Atomic multiple service bookings
-- Wraps multiple book_appointment calls into a single transaction.
-- If any service fails (e.g. out of capacity), the entire block rolls back
-- preventing "partial bookings" for the citizen.

CREATE OR REPLACE FUNCTION public.book_multiple_appointments(
  _institution_id uuid,
  _service_ids    uuid[],
  _full_name      text,
  _phone          text,
  _national_id    text,
  _date           date,
  _window         public.appointment_window
) RETURNS TABLE(
  reference text,
  queue_number int,
  slot_window public.appointment_window,
  appointment_date date,
  service_id uuid,
  full_name text
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _svc_id uuid;
  _row public.appointments;
BEGIN
  -- Loop through each service ID array element
  FOREACH _svc_id IN ARRAY _service_ids
  LOOP
    -- Call the existing secure booking function.
    -- If it RAISES an exception, this entire transaction will rollback.
    _row := public.book_appointment(
      _institution_id,
      _svc_id,
      _full_name,
      _phone,
      _national_id,
      _date,
      _window
    );
    
    reference := _row.reference;
    queue_number := _row.queue_number;
    slot_window := _row.slot_window;
    appointment_date := _row.appointment_date;
    service_id := _row.service_id;
    full_name := _row.full_name;
    
    -- Yield this row to the result table
    RETURN NEXT;
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.book_multiple_appointments(
  uuid, uuid[], text, text, text, date, public.appointment_window
) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.book_multiple_appointments(
  uuid, uuid[], text, text, text, date, public.appointment_window
) FROM anon;
