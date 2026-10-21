
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS institution_id uuid;

CREATE TABLE public.institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.institutions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.institutions TO authenticated;
GRANT ALL ON public.institutions TO service_role;
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view institutions" ON public.institutions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin ins institutions" ON public.institutions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin upd institutions" ON public.institutions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin del institutions" ON public.institutions FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER set_institutions_updated_at BEFORE UPDATE ON public.institutions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  estimated_duration_min int NOT NULL DEFAULT 20,
  am_capacity int NOT NULL DEFAULT 20,
  pm_capacity int NOT NULL DEFAULT 20,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_services_institution ON public.services(institution_id);
GRANT SELECT ON public.services TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view services" ON public.services FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin ins services" ON public.services FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin upd services" ON public.services FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin del services" ON public.services FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER set_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TYPE public.appointment_status AS ENUM ('pending','served','no_show','cancelled');
CREATE TYPE public.appointment_window AS ENUM ('AM','PM');

CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE RESTRICT,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  full_name text NOT NULL,
  phone text NOT NULL,
  national_id text NOT NULL,
  appointment_date date NOT NULL,
  slot_window public.appointment_window NOT NULL,
  queue_number int NOT NULL,
  status public.appointment_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, appointment_date, slot_window, service_id, queue_number)
);
CREATE INDEX idx_appt_inst_date ON public.appointments(institution_id, appointment_date);
CREATE INDEX idx_appt_user ON public.appointments(user_id);

GRANT SELECT, INSERT, UPDATE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_institution(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT institution_id FROM public.profiles WHERE id = _user_id
$$;

CREATE POLICY "read appts" ON public.appointments
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(),'admin')
    OR (public.has_role(auth.uid(),'agent') AND institution_id = public.user_institution(auth.uid()))
  );

CREATE POLICY "create appt" ON public.appointments
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "update appt" ON public.appointments
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(),'admin')
    OR (public.has_role(auth.uid(),'agent') AND institution_id = public.user_institution(auth.uid()))
    OR (user_id = auth.uid() AND status = 'pending')
  ) WITH CHECK (
    public.has_role(auth.uid(),'admin')
    OR (public.has_role(auth.uid(),'agent') AND institution_id = public.user_institution(auth.uid()))
    OR user_id = auth.uid()
  );

CREATE TRIGGER set_appt_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.book_appointment(
  _institution_id uuid,
  _service_id uuid,
  _full_name text,
  _phone text,
  _national_id text,
  _date date,
  _window public.appointment_window
) RETURNS public.appointments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _qnum int;
  _ref text;
  _capacity int;
  _row public.appointments;
BEGIN
  SELECT CASE WHEN _window = 'AM' THEN am_capacity ELSE pm_capacity END
    INTO _capacity FROM public.services WHERE id = _service_id AND institution_id = _institution_id AND active = true;
  IF _capacity IS NULL THEN RAISE EXCEPTION 'Invalid service or institution'; END IF;

  SELECT COALESCE(MAX(queue_number),0) + 1 INTO _qnum
    FROM public.appointments
    WHERE institution_id = _institution_id
      AND appointment_date = _date
      AND slot_window = _window
      AND service_id = _service_id;

  IF _qnum > _capacity THEN RAISE EXCEPTION 'No slots remaining for that window'; END IF;

  _ref := 'HWS-' || to_char(_date,'YYYYMMDD') || '-' || _window::text || '-' || lpad(_qnum::text,3,'0');

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

GRANT EXECUTE ON FUNCTION public.book_appointment(uuid,uuid,text,text,text,date,public.appointment_window) TO authenticated;

CREATE OR REPLACE FUNCTION public.lookup_appointment(_ref text)
RETURNS TABLE(
  reference text,
  full_name text,
  appointment_date date,
  slot_window public.appointment_window,
  queue_number int,
  status public.appointment_status,
  institution_name text,
  service_name text
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.reference, a.full_name, a.appointment_date, a.slot_window, a.queue_number,
         a.status, i.name, s.name
    FROM public.appointments a
    JOIN public.institutions i ON i.id = a.institution_id
    JOIN public.services s ON s.id = a.service_id
    WHERE a.reference = _ref
$$;
GRANT EXECUTE ON FUNCTION public.lookup_appointment(text) TO anon, authenticated;
