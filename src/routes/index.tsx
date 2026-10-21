import { createFileRoute } from "@tanstack/react-router";
import HomePage from "@/pages/HomePage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MESOB Hawassa — Government Service Appointments" },
      {
        name: "description",
        content:
          "Skip the queue. Book or look up appointments for government services in Hawassa, Ethiopia.",
      },
      { property: "og:title", content: "MESOB Hawassa — Online Appointment Booking" },
      {
        property: "og:description",
        content: "Book government service appointments in Hawassa, Ethiopia.",
      },
    ],
  }),
  component: HomePage,
});
