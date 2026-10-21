import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type UserRole = "admin" | "agent" | "citizen" | null;

export interface AuthUser {
  id: string;
  email: string;
  full_name?: string | null;
  role: Exclude<UserRole, null>;
  institution_id?: string | null;
}

interface SignUpInput {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  national_id?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  session: Session | null;
  role: UserRole;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function buildAuthUser(u: User): Promise<AuthUser> {
  const { data: rolesData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", u.id);
  const roles = (rolesData ?? []).map((r: any) => r.role);
  const role: AuthUser["role"] = roles.includes("admin")
    ? "admin"
    : roles.includes("agent")
    ? "agent"
    : "citizen";
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, institution_id")
    .eq("id", u.id)
    .maybeSingle();
  return {
    id: u.id,
    email: u.email ?? "",
    full_name: profile?.full_name ?? (u.user_metadata?.full_name as string) ?? null,
    role,
    institution_id: profile?.institution_id ?? null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      if (sess?.user) {
        setTimeout(() => {
          buildAuthUser(sess.user).then(setUser).catch(() => setUser(null));
        }, 0);
      } else {
        setUser(null);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        buildAuthUser(data.session.user)
          .then(setUser)
          .catch(() => setUser(null))
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }, []);

  const signUp = useCallback(async (input: SignUpInput) => {
    const { error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          full_name: input.full_name,
          phone: input.phone ?? "",
          national_id: input.national_id ?? "",
        },
      },
    });
    if (error) throw new Error(error.message);
  }, []);

const signInWithGoogle = async (redirectPath?: string) => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}${redirectPath ?? "/book"}`,
    },
  });
  if (error) throw error;
};

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user, session, role: user?.role ?? null, loading,
      signIn, signUp, signInWithGoogle, logout,
    }),
    [user, session, loading, signIn, signUp, signInWithGoogle, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
