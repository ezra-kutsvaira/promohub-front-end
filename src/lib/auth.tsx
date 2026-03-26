import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, type AuthPayload, type LoginRequest, type RegisterRequest } from "@/lib/api";
import { clearStagedSession, loadRequestSession, loadSession, saveSession } from "@/lib/session";

type RawUserRole = "ADMIN" | "BUSINESS_OWNER" | "CONSUMER" | "CUSTOMER";
export type UserRole = "ADMIN" | "BUSINESS_OWNER" | "CONSUMER";

export type AuthUser = {
  id: number;
  fullName: string;
  email: string;
  role: UserRole;
  verified: boolean;
};

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  signIn: (payload: LoginRequest) => Promise<void>;
  register: (payload: RegisterRequest) => Promise<AuthPayload>;
  establishSession: (payload: AuthPayload) => void;
  signOut: () => Promise<void>;
  updateUser: (updates: { fullName: string; password?: string; profileImageURL?: string }) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const normalizeUserRole  = (role: string): UserRole => {
      if(role == "CUSTOMER"){
            return "CONSUMER";
      }

      if ( role === "ADMIN" || role === "BUSINESS_OWNER" || role === "CONSUMER"){
            return role;
      }

      return "CONSUMER";
};

const mapPayloadToUser = (payload: AuthPayload): AuthUser => ({
  id: payload.userId,
  fullName: payload.fullName,
  email: payload.email,
  role: normalizeUserRole(payload.userRole),
  verified: payload.verified,
});

const loadStoredUser = (): AuthUser | null => {
  const session = loadSession();
  if (!session) {
    return null;
  }
  return {
    id: session.userId,
    fullName: session.fullName,
    email: session.email,
    role: normalizeUserRole(session.userRole as RawUserRole),
    verified: session.verified,
  };
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(() => loadStoredUser());

  useEffect(() => {
    if (user) {
      const session = loadSession();
      if (session) {
        saveSession({ ...session, userId: user.id, fullName: user.fullName, email: user.email, userRole: user.role });
      }
    }
  }, [user]);

  const establishSession = useCallback((payload: AuthPayload) => {
    saveSession(payload);
    setUser(mapPayloadToUser(payload));
  }, []);

  const signIn = useCallback(async (payload: LoginRequest) => {
    const authResponse = await api.login(payload);
    establishSession(authResponse);
  }, [establishSession]);

  const register = useCallback(async (payload: RegisterRequest) => {
    const authResponse = await api.register(payload);
    establishSession(authResponse);
    return authResponse;
  }, [establishSession]);

  const signOut = useCallback(async () => {
    const session = loadRequestSession();
    if (session?.refreshToken) {
      try {
        await api.logout(session.refreshToken);
      } catch {
        // ignore logout errors
      }
    }
    clearStagedSession();
    saveSession(null);
    setUser(null);
  }, []);

  const updateUser = useCallback(async (updates: { fullName: string; password?: string; profileImageURL?: string }) => {
    if (!user) {
      return;
    }
    await api.updateUser(user.id, updates);
    setUser((current) => {
      if (!current) {
        return current;
      }
      return { ...current, fullName: updates.fullName };
    });
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      signIn,
      register,
      establishSession,
      signOut,
      updateUser,
    }),
    [user, signIn, register, establishSession, signOut, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
