
-- Add rate limiting to book_appointment to prevent slot exhaustion.
--
-- Problem: any authenticated user could call book_appointment in a loop
-- and exhaust every capacity slot across all services.
--
-- Limits enforced (per-user):
--   1. Cannot book the same service+date+window twice (duplicate check)
--   2. Max 20 non-cancelled appointments per day
--   3. Max 10 non-cancelled appointments per window (AM/PM) per day

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
  _qnum         int;
  _ref          text;
  _capacity     int;
  _row          public.appointments;
  _uid          uuid;
  _duplicate    int;
  _daily_count  int;
  _window_count int;
  _user_daily_max   CONSTANT int := 20;
  _user_window_max  CONSTANT int := 10;
BEGIN
  _uid := auth.uid();

  -- 0a. Duplicate check — same user, service, date, window
  SELECT count(*) INTO _duplicate
    FROM public.appointments
   WHERE user_id          = _uid
     AND service_id       = _service_id
     AND appointment_date = _date
     AND slot_window      = _window
     AND status           <> 'cancelled';

  IF _duplicate > 0 THEN
    RAISE EXCEPTION 'You already have an active booking for this service on this date and window.';
  END IF;

  -- 0b. Per-user daily total cap
  SELECT count(*) INTO _daily_count
    FROM public.appointments
   WHERE user_id          = _uid
     AND appointment_date = _date
     AND status           <> 'cancelled';

  IF _daily_count >= _user_daily_max THEN
    RAISE EXCEPTION 'You cannot book more than % appointments per day.', _user_daily_max;
  END IF;

  -- 0c. Per-user per-window cap
  SELECT count(*) INTO _window_count
    FROM public.appointments
   WHERE user_id          = _uid
     AND appointment_date = _date
     AND slot_window      = _window
     AND status           <> 'cancelled';

  IF _window_count >= _user_window_max THEN
    RAISE EXCEPTION 'You cannot book more than % appointments in the % window.', _user_window_max, _window;
  END IF;

  -- 1. Validate service, institution, and get capacity for the window
  SELECT CASE WHEN _window = 'AM' THEN am_capacity ELSE pm_capacity END
    INTO _capacity
    FROM public.services
   WHERE id              = _service_id
     AND institution_id  = _institution_id
     AND active          = true;

  IF _capacity IS NULL THEN
    RAISE EXCEPTION 'Service not found or not active for this institution';
  END IF;

  -- 2. Lock this specific service slot to prevent concurrent race
  PERFORM pg_advisory_xact_lock(
    hashtext(_service_id::text || _date::text || _window::text)
  );

  -- 3. Compute next queue number for THIS service on THIS date/window
  SELECT COALESCE(MAX(queue_number), 0) + 1
    INTO _qnum
    FROM public.appointments
   WHERE service_id      = _service_id
     AND institution_id  = _institution_id
     AND appointment_date = _date
     AND slot_window     = _window;

  IF _qnum > _capacity THEN
    RAISE EXCEPTION 'No slots remaining for the % window (capacity %)', _window, _capacity;
  END IF;

  -- 4. Build reference
  _ref := 'HWS-'
       || to_char(_date, 'YYYYMMDD') || '-'
       || _window::text              || '-'
       || _service_id::text          || '-'
       || lpad(_qnum::text, 3, '0');

  -- 5. Insert
  INSERT INTO public.appointments(
    reference, user_id, institution_id, service_id,
    full_name, phone, national_id,
    appointment_date, slot_window, queue_number
  ) VALUES (
    _ref,
    _uid,
    _institution_id,
    _service_id,
    _full_name,
    _phone,
    _national_id,
    _date,
    _window,
    _qnum
  ) RETURNING * INTO _row;

  RETURN _row;
END $$;

-- Re-apply grants (they persist across CREATE OR REPLACE, but explicit is safe)
GRANT EXECUTE ON FUNCTION public.book_appointment(
  uuid, uuid, text, text, text, date, public.appointment_window
) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.book_appointment(
  uuid, uuid, text, text, text, date, public.appointment_window
) FROM anon;
