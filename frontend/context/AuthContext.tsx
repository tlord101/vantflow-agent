'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '@/lib/api';
import { cookieUtils } from '@/lib/cookies';

interface User {
  id: string;
  email: string;
  name?: string;
  organizationId?: string | null;
  organization?: {
    id: string;
    name: string;
  } | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = cookieUtils.getToken();
      if (token) {
        const response = await authApi.getSession();
        setUser(response.data.user);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      cookieUtils.removeToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await authApi.login({ email, password });
      const { token, user } = response.data;
      
      // Store token in cookie
      cookieUtils.setToken(token);
      setUser(user);
    } catch (error: any) {
      // Let the component handle the error
      throw error;
    }
  };

  const register = async (email: string, password: string, name?: string) => {
    try {
      const response = await authApi.register({ email, password, name });
      const { token, user } = response.data;
      
      // Store token in cookie
      cookieUtils.setToken(token);
      setUser(user);
    } catch (error: any) {
      // Let the component handle the error
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      cookieUtils.removeToken();
      setUser(null);
    }
  };

  const refreshUser = async () => {
    try {
      const response = await authApi.getSession();
      setUser(response.data.user);
    } catch (error) {
      console.error('Refresh user failed:', error);
      cookieUtils.removeToken();
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        isAuthenticated: !!user,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
