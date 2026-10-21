import { createFileRoute } from "@tanstack/react-router";
import Appointments from "@/pages/admin/Appointments";
export const Route = createFileRoute("/admin/appointments")({ component: Appointments });
