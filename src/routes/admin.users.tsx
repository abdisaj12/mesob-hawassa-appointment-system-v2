import { createFileRoute } from "@tanstack/react-router";
import ProtectedRoute from "@/components/ProtectedRoute";
import Users from "@/pages/admin/Users";

export const Route = createFileRoute("/admin/users")({
  component: () => (
    <ProtectedRoute allowedRoles={["admin"]}>
      <Users />
    </ProtectedRoute>
  ),
});
