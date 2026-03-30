import { create } from "zustand";
import { Session } from "@supabase/supabase-js";

type UserRole = "admin" | "servant";

interface ServantProfile {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  role: UserRole;
  regions: string[];
  preferredLanguage: string;
}

interface AuthState {
  session: Session | null;
  profile: ServantProfile | null;
  isLoading: boolean;
  hasCompletedOnboarding: boolean;
  setSession: (session: Session | null) => void;
  setProfile: (profile: ServantProfile | null) => void;
  setLoading: (loading: boolean) => void;
  setHasCompletedOnboarding: (completed: boolean) => void;
  isAdmin: () => boolean;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  isLoading: true,
  hasCompletedOnboarding: false,
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setLoading: (isLoading) => set({ isLoading }),
  setHasCompletedOnboarding: (hasCompletedOnboarding) =>
    set({ hasCompletedOnboarding }),
  isAdmin: () => get().profile?.role === "admin",
  reset: () =>
    set({ session: null, profile: null, isLoading: false }),
}));
