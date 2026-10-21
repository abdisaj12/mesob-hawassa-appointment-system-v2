-- ============================================================
-- Migration: fix duplicate reference key on multi-service booking
-- ============================================================
--
-- THE BUG:
--   Old reference format: HWS-YYYYMMDD-AM-001
--   queue_number is counted per (institution, date, window, SERVICE).
--   When a citizen books "Card Recharge" + "License Renewal" on the
--   same date/window, BOTH get queue_number=1 on their first booking,
--   producing the identical string "HWS-20260612-AM-001", and PostgreSQL
--   crashes on the UNIQUE constraint on appointments.reference.
--
-- THE FIX:
--   Embed the full service UUID into the reference so it is structurally
--   unique per service — no random suffix, no retry loop needed.
--
--   New format:  HWS-YYYYMMDD-AM-<SERVICE_UUID>-001
--     SERVICE_UUID = full service UUID (guarantees global uniqueness)
--     001          = zero-padded queue number for that service slot
--
--   Example: HWS-20260612-AM-a1b2c3d4-e5f6-7890-abcd-ef1234567890-001
--
--   The reference is longer but completely unambiguous and still
--   scannable at the counter.
--
--   Also adds a pg_advisory_xact_lock so two concurrent bookings for
--   the same service slot can never race and produce the same queue_number.
-- ============================================================

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
BEGIN
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
  --    Two citizens booking the same service/date/window at the same moment
  --    will now be serialised instead of both getting queue_number=1.
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

  -- 4. Build reference — deterministically unique because it contains the full service UUID
  --    Format: HWS-YYYYMMDD-<WINDOW>-<SERVICE_UUID>-<QQQ>
  _ref := 'HWS-'
       || to_char(_date, 'YYYYMMDD') || '-'
       || _window::text              || '-'
       || _service_id::text          || '-'
       || lpad(_qnum::text, 3, '0');

  -- 5. Insert — this can never violate the unique constraint because
  --    (service_uuid, date, window, queue_number) is structurally unique
  INSERT INTO public.appointments(
    reference, user_id, institution_id, service_id,
    full_name, phone, national_id,
    appointment_date, slot_window, queue_number
  ) VALUES (
    _ref,
    auth.uid(),
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

-- Keep existing grants
GRANT EXECUTE ON FUNCTION public.book_appointment(
  uuid, uuid, text, text, text, date, public.appointment_window
) TO authenticated;

-- Ensure anon cannot call it (only logged-in citizens should book)
REVOKE EXECUTE ON FUNCTION public.book_appointment(
  uuid, uuid, text, text, text, date, public.appointment_window
) FROM anon;

-- ──────────────────────────────────────────────────────────────
-- Also fix lookup_appointment to trim/uppercase input
-- so "hws-20260612-am-..." works the same as "HWS-..."
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.lookup_appointment(_ref text)
RETURNS TABLE(
  reference        text,
  full_name        text,
  appointment_date date,
  slot_window      public.appointment_window,
  queue_number     int,
  status           public.appointment_status,
  institution_name text,
  service_name     text
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.reference, a.full_name, a.appointment_date, a.slot_window,
         a.queue_number, a.status, i.name AS institution_name, s.name AS service_name
    FROM public.appointments a
    JOIN public.institutions i ON i.id = a.institution_id
    JOIN public.services     s ON s.id = a.service_id
   WHERE a.reference = upper(trim(_ref))
$$;

GRANT EXECUTE ON FUNCTION public.lookup_appointment(text) TO anon, authenticated;

-- ──────────────────────────────────────────────────────────────
-- Index on reference for fast lookups (safe to run multiple times)
-- ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_appt_reference ON public.appointments(reference);
