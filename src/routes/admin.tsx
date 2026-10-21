import { createFileRoute } from "@tanstack/react-router";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminShell from "@/components/AdminShell";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — MESOB Hawassa" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["admin", "agent"]}>
      <AdminShell />
    </ProtectedRoute>
  ),
});
