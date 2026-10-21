
-- ============================================================
-- Migration: enable RLS on support_chats, support_messages, feedback
-- ============================================================
--
-- Problem: these three tables were created without RLS policies,
-- meaning either (a) they are fully wide-open to all authenticated
-- users, or (b) Supabase's default DENY ALL has locked them,
-- silently breaking the support chat and feedback features.
--
-- Fix: create them in migrations (if missing), enable RLS, and
-- add proper row-level policies mirroring how the app accesses
-- them (see SupportChatWidget, FeedbackWidget, and admin pages).
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. support_chats
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.support_chats (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  issue      text NOT NULL,
  subject    text NOT NULL,
  status     text NOT NULL DEFAULT 'open',
  lang       text NOT NULL DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_chats ENABLE ROW LEVEL SECURITY;

-- Citizens: see only their own chats
CREATE POLICY "citizen select own chats"
  ON public.support_chats FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND NOT public.has_role(auth.uid(), 'admin')
    AND NOT public.has_role(auth.uid(), 'agent')
  );

-- Citizens: create a new chat
CREATE POLICY "citizen insert own chats"
  ON public.support_chats FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND NOT public.has_role(auth.uid(), 'admin')
    AND NOT public.has_role(auth.uid(), 'agent')
  );

-- Admins: full access
CREATE POLICY "admin all chats"
  ON public.support_chats
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Agents: full access (support panel does not filter by institution)
CREATE POLICY "agent all chats"
  ON public.support_chats
  TO authenticated
  USING (public.has_role(auth.uid(), 'agent'))
  WITH CHECK (public.has_role(auth.uid(), 'agent'));

-- ──────────────────────────────────────────────────────────────
-- 2. support_messages
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.support_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id    uuid NOT NULL REFERENCES public.support_chats(id) ON DELETE CASCADE,
  sender_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body       text NOT NULL,
  is_support boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Citizens: read messages in their own chats
CREATE POLICY "citizen select own messages"
  ON public.support_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.support_chats
      WHERE id = chat_id AND user_id = auth.uid()
    )
    AND NOT public.has_role(auth.uid(), 'admin')
    AND NOT public.has_role(auth.uid(), 'agent')
  );

-- Citizens: send messages (must be to own chat, must be citizen
-- — i.e. is_support = false — so they cannot impersonate staff)
CREATE POLICY "citizen insert own messages"
  ON public.support_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    is_support = false
    AND sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.support_chats
      WHERE id = chat_id AND user_id = auth.uid()
    )
  );

-- Admins: full access
CREATE POLICY "admin all messages"
  ON public.support_messages
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Agents: full access
CREATE POLICY "agent all messages"
  ON public.support_messages
  TO authenticated
  USING (public.has_role(auth.uid(), 'agent'))
  WITH CHECK (public.has_role(auth.uid(), 'agent'));

-- ──────────────────────────────────────────────────────────────
-- 3. feedback
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.feedback (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id  uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  service_id      uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  rating          int NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment         text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (appointment_id, user_id)
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Citizens: read their own feedback
CREATE POLICY "citizen select own feedback"
  ON public.feedback FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND NOT public.has_role(auth.uid(), 'admin')
    AND NOT public.has_role(auth.uid(), 'agent')
  );

-- Citizens: submit feedback (must be own user_id)
CREATE POLICY "citizen insert own feedback"
  ON public.feedback FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND NOT public.has_role(auth.uid(), 'admin')
    AND NOT public.has_role(auth.uid(), 'agent')
  );

-- Admins: full access
CREATE POLICY "admin all feedback"
  ON public.feedback
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Agents: read feedback scoped to their institution
CREATE POLICY "agent select institution feedback"
  ON public.feedback FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'agent')
    AND institution_id = public.user_institution(auth.uid())
  );
