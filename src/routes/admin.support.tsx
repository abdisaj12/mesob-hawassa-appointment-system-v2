import { createFileRoute } from "@tanstack/react-router";
import SupportAdminPage from "@/pages/admin/Support";
export const Route = createFileRoute("/admin/support")({ component: SupportAdminPage });
