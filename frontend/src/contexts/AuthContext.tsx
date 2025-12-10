import React, { createContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import apiClient, {
  setAccessToken,
  setRefreshToken,
  getRefreshToken,
  clearTokens,
} from "../api/axios";
import type { User, LoginCredentials, GoogleAuthRequest } from "../types";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  loginWithGoogle: (request: GoogleAuthRequest) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  setUserData: (userData: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Export AuthContext for useAuth hook
export { AuthContext };

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Check for existing refresh token on mount
  useEffect(() => {
    const initAuth = async () => {
      const refreshToken = getRefreshToken();

      if (refreshToken) {
        try {
          // Try to refresh the access token
          const response = await apiClient.post("/auth/refresh", {
            refreshToken,
          });
          const { accessToken } = response.data;

          setAccessToken(accessToken);

          // Decode JWT to get user info since /auth/refresh doesn't return user data
          const payload = JSON.parse(atob(accessToken.split(".")[1]));
          const userData: User = {
            id: payload.userId,
            email: payload.email,
            name: payload.email.split("@")[0],
          };
          setUser(userData);
        } catch {
          // Refresh failed, clear tokens
          clearTokens();
        }
      }

      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (credentials: LoginCredentials) => {
    try {
      const response = await apiClient.post("/auth/login", credentials);
      const { accessToken, refreshToken, user: userData } = response.data;

      setAccessToken(accessToken);
      setRefreshToken(refreshToken);
      setUser(userData);

      navigate("/inbox");
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      throw new Error(
        err.response?.data?.message || "Login failed. Please try again."
      );
    }
  };

  const loginWithGoogle = async (request: GoogleAuthRequest) => {
    try {
      const response = await apiClient.post("/auth/google", request);
      const { accessToken, refreshToken, user: userData } = response.data;

      setAccessToken(accessToken);
      setRefreshToken(refreshToken);
      setUser(userData);

      navigate("/inbox");
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      throw new Error(
        err.response?.data?.message ||
          "Google login failed. Please try again."
      );
    }
  };

  const logout = () => {
    clearTokens();
    setUser(null);
    navigate("/login");
  };

  const setUserData = useCallback((userData: User) => {
    setUser(userData);
  }, []);

  const value: AuthContextType = {
    user,
    loading,
    login,
    loginWithGoogle,
    logout,
    isAuthenticated: !!user,
    setUserData,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
