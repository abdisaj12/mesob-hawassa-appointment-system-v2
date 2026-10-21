import { createFileRoute, redirect } from "@tanstack/react-router";
import BookingWizard from "@/pages/BookingWizard";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/book")({
  head: () => ({
    meta: [
      { title: "Book an appointment — MESOB Hawassa" },
      { name: "description", content: "Book your visit to the MESOB Hawassa government service center in 4 simple steps." },
    ],
  }),
  // Guard: must be logged in to book. If not, send to login and come back here after.
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({ to: "/login", search: { redirect: "/book" } });
    }
  },
  component: BookingWizard,
});
