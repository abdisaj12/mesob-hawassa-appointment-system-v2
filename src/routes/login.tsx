import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import LoginPage from "@/pages/LoginPage";

// Declare the search params so TanStack Router validates and passes them through
const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — MESOB Hawassa" }] }),
  validateSearch: searchSchema,
  component: LoginPage,
});
