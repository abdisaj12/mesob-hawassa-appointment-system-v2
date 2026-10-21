import { Navigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAuth, type UserRole } from "@/context/AuthContext";

interface Props {
  children: ReactNode;
  allowedRoles?: Array<Exclude<UserRole, null>>;
}

export default function ProtectedRoute({ children, allowedRoles }: Props) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Logged in but wrong role — send home.
    return <Navigate to="/" />;
  }
  return <>{children}</>;
}
