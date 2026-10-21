-- Fix: duplicate reference key when two different services are booked
-- on the same date + window at the same institution.
--
-- Root cause: the old reference format was:
--   HWS-YYYYMMDD-AM-001
-- The queue_number is scoped per (institution, date, window, SERVICE),
-- so two different services both produce queue_number=1 on their first booking,
-- generating the same reference string and crashing on the unique constraint.
--
-- Fix: include the first 4 characters of the service UUID in the reference
-- so it is unique per service, and append a 4-char random hex suffix as a
-- final safety net against any remaining collision edge cases.
--
-- New format:  HWS-YYYYMMDD-AM-XXXX-001-rrrr
--   XXXX  = first 4 chars of service UUID  (service discriminator)
--   001   = zero-padded queue number        (position in that service's queue)
--   rrrr  = 4 random hex chars             (collision-proof safety net)
--
-- The reference is still human-readable and scannable at the counter.

CREATE OR REPLACE FUNCTION public.book_appointment(
  _institution_id uuid,
  _service_id     uuid,
  _full_name      text,
  _phone          text,
  _national_id    text,
  _date           date,
  _window         public.appointment_window
) RETURNS public.appointments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _qnum     int;
  _ref      text;
  _capacity int;
  _row      public.appointments;
  _svc_tag  text;
  _rand     text;
BEGIN
  -- 1. Validate service belongs to institution and is active; get capacity
  SELECT CASE WHEN _window = 'AM' THEN am_capacity ELSE pm_capacity END
    INTO _capacity
    FROM public.services
   WHERE id = _service_id
     AND institution_id = _institution_id
     AND active = true;

  IF _capacity IS NULL THEN
    RAISE EXCEPTION 'Invalid service or institution';
  END IF;

  -- 2. Compute next queue number for this specific service slot
  SELECT COALESCE(MAX(queue_number), 0) + 1
    INTO _qnum
    FROM public.appointments
   WHERE institution_id    = _institution_id
     AND appointment_date  = _date
     AND slot_window       = _window
     AND service_id        = _service_id;

  IF _qnum > _capacity THEN
    RAISE EXCEPTION 'No slots remaining for that window';
  END IF;

  -- 3. Build a unique reference
  --    Format: HWS-YYYYMMDD-AM-XXXX-001-rrrr
  _svc_tag := upper(left(_service_id::text, 4));   -- first 4 chars of service UUID
  _rand    := upper(substring(md5(random()::text) from 1 for 4));  -- 4 random hex chars

  _ref := 'HWS-'
       || to_char(_date, 'YYYYMMDD') || '-'
       || _window::text             || '-'
       || _svc_tag                  || '-'
       || lpad(_qnum::text, 3, '0') || '-'
       || _rand;

  -- 4. Insert the appointment
  INSERT INTO public.appointments(
    reference, user_id, institution_id, service_id,
    full_name, phone, national_id,
    appointment_date, slot_window, queue_number
  ) VALUES (
    _ref, auth.uid(), _institution_id, _service_id,
    _full_name, _phone, _national_id,
    _date, _window, _qnum
  ) RETURNING * INTO _row;

  RETURN _row;
END $$;

GRANT EXECUTE ON FUNCTION public.book_appointment(
  uuid, uuid, text, text, text, date, public.appointment_window
) TO authenticated;
