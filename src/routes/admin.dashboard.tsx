import { createFileRoute } from "@tanstack/react-router";
import Dashboard from "@/pages/admin/Dashboard";
export const Route = createFileRoute("/admin/dashboard")({ component: Dashboard });
