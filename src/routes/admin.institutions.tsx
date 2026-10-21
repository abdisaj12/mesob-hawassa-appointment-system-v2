import { createFileRoute } from "@tanstack/react-router";
import Institutions from "@/pages/admin/Institutions";
export const Route = createFileRoute("/admin/institutions")({ component: Institutions });
