import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '@/services/api';
import type { User, UserRole } from '@/types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (identifier: string, password: string, remember?: boolean) => Promise<User>;
  loginPatient: (name: string, portalId: string, remember?: boolean, pin?: string) => Promise<User>;
  demoLogin: (role: 'admin' | 'doctor' | 'labtech' | 'patient') => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  hasRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refresh = useCallback(async () => {
    try {
      const res = await api.auth.me();
      if (res.authenticated && res.user) {
        setUser(res.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (identifier: string, password: string, remember = false) => {
    setIsLoading(true);
    try {
      const res = await api.auth.login(identifier, password, remember);
      setUser(res.user);
      return res.user;
    } finally {
      setIsLoading(false);
    }
  };

  const loginPatient = async (
    name: string,
    portalId: string,
    rememberOrPin?: boolean | string,
    optionalPin?: string
  ) => {
    setIsLoading(true);
    try {
      let remember = false;
      let pin: string | undefined = undefined;
      if (typeof rememberOrPin === 'boolean') {
        remember = rememberOrPin;
        pin = optionalPin;
      } else if (typeof rememberOrPin === 'string') {
        pin = rememberOrPin;
        remember = Boolean(optionalPin);
      }
      const res = await api.auth.patientLogin(name, portalId, remember, pin);
      setUser(res.user);
      return res.user;
    } finally {
      setIsLoading(false);
    }
  };

  const demoLogin = async (role: 'admin' | 'doctor' | 'labtech' | 'patient') => {
    setIsLoading(true);
    try {
      const res = await api.auth.demoLogin(role);
      setUser(res.user);
      return res.user;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } finally {
      setUser(null);
      window.location.href = '/';
    }
  };

  const hasRole = (...roles: UserRole[]) => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        loginPatient,
        demoLogin,
        logout,
        refresh,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
