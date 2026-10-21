import { createFileRoute } from "@tanstack/react-router";
import HistoryPage from "@/pages/HistoryPage";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "My Appointments — MESOB Hawassa" },
      { name: "description", content: "View and manage your booked appointments." },
    ],
  }),
  component: HistoryPage,
});
