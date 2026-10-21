import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Calendar,
  Briefcase,
  Building2,
  Users,
  LogOut,
  Menu,
  X,
  Star,
  MessageCircle,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV: {
  to: string;
  label: string;
  icon: any;
  roles: Array<"admin" | "agent">;
}[] = [
  {
    to: "/admin/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["admin", "agent"],
  },
  {
    to: "/admin/appointments",
    label: "Appointments",
    icon: Calendar,
    roles: ["admin", "agent"],
  },
  {
    to: "/admin/institutions",
    label: "Institutions",
    icon: Building2,
    roles: ["admin"],
  },
  {
    to: "/admin/services",
    label: "Services",
    icon: Briefcase,
    roles: ["admin"],
  },
  {
    to: "/admin/users",
    label: "Users",
    icon: Users,
    roles: ["admin"],
  },
  {
    to: "/admin/feedback",
    label: "Feedback",
    icon: Star,
    roles: ["admin", "agent"],
  },
  {
    to: "/admin/support",
    label: "Support",
    icon: MessageCircle,
    roles: ["admin"],
  },
];

function NavLinks({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const { user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <>
      {NAV.filter(
        (n) => user && n.roles.includes(user.role as "admin" | "agent")
      ).map((n) => {
        const Icon = n.icon;
        const active = pathname.startsWith(n.to);
        return (
          <Link
            key={n.to}
            to={n.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {n.label}
          </Link>
        );
      })}
    </>
  );
}

export default function AdminShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const onLogout = async () => {
    await logout();
    navigate({ to: "/login" });
  };

  const isAdmin = user?.role === "admin";
  const consoleLabel = isAdmin ? "Admin Console" : "Staff Console";

  const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      {/* Brand */}
      <div className="border-b p-4 bg-brand-gradient text-white">
        <Link
          to="/"
          onClick={onNavigate}
          className="flex items-center gap-2"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20 font-bold text-white">
            M
          </div>
          <div>
            <p className="text-sm font-bold leading-none">MESOB Hawassa</p>
            <p className="text-[11px] text-white/80">{consoleLabel}</p>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 p-3">
        <NavLinks onNavigate={onNavigate} />
      </nav>

      {/* User info + logout */}
      <div className="border-t p-3">
        <div className="mb-2 rounded-md bg-muted px-3 py-2 text-xs">
          <p className="truncate font-medium text-foreground">{user?.email}</p>
          <p className="capitalize text-muted-foreground">
            {user?.role === "agent" ? "Staff" : user?.role}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={onLogout}
        >
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-muted/40">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-card md:flex">
        <SidebarContent />
      </aside>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-card transition-transform duration-200 md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent onNavigate={() => setMobileOpen(false)} />
      </aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile topbar */}
        <header className="flex items-center justify-between border-b bg-card px-4 py-3 md:hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <p className="font-semibold text-foreground">
            MESOB {isAdmin ? "Admin" : "Staff"}
          </p>
          <Button variant="ghost" size="sm" onClick={onLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
