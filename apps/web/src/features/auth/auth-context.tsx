"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { apiFetch } from "@/lib/api";
import type { LoginPayload, RegisterPayload, TokenResponse, User } from "@/lib/types";

const TOKEN_STORAGE_KEY = "gabinet.access_token";

type AuthContextValue = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (payload: LoginPayload) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const stored = window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (!stored) {
      queueMicrotask(() => {
        if (active) {
          setLoading(false);
        }
      });
      return () => {
        active = false;
      };
    }
    queueMicrotask(() => {
      if (active) {
        setToken(stored);
      }
    });
    apiFetch<User>("/auth/me", { token: stored, onUnauthorized: logout })
      .then((me) => {
        if (active) {
          setUser(me);
        }
      })
      .catch(() => {
        if (active) {
          logout();
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [logout]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      const tokenResponse = await apiFetch<TokenResponse>("/auth/login", {
        method: "POST",
        body: payload,
      });
      const me = await apiFetch<User>("/auth/me", {
        token: tokenResponse.access_token,
      });
      window.sessionStorage.setItem(TOKEN_STORAGE_KEY, tokenResponse.access_token);
      setToken(tokenResponse.access_token);
      setUser(me);
      return me;
    },
    [],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      await apiFetch<User>("/auth/register", {
        method: "POST",
        body: payload,
      });
      return login({ email: payload.email, password: payload.password });
    },
    [login],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, loading, login, register, logout }),
    [user, token, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth musi być używany wewnątrz AuthProvider.");
  }
  return context;
}

export function useAuthorizedFetch() {
  const { token, logout } = useAuth();
  return useCallback(
    <T,>(path: string, options: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown } = {}) =>
      apiFetch<T>(path, { ...options, token, onUnauthorized: logout }),
    [token, logout],
  );
}
