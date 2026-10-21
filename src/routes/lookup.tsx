import { createFileRoute } from "@tanstack/react-router";
import LookupPage from "@/pages/LookupPage";

export const Route = createFileRoute("/lookup")({
  head: () => ({
    meta: [
      { title: "Look up appointment — MESOB Hawassa" },
      { name: "description", content: "Look up your MESOB Hawassa appointment by reference number." },
    ],
  }),
  component: LookupPage,
});
