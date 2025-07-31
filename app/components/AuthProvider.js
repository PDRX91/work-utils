"use client";

import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [sessionId, setSessionId] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load session from localStorage on mount
    const storedSession = localStorage.getItem("session-id");
    if (storedSession) {
      setSessionId(storedSession);
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  const login = async (password) => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (response.ok) {
        setSessionId(data.sessionId);
        setIsAuthenticated(true);
        localStorage.setItem("session-id", data.sessionId);
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      return { success: false, error: "Login failed" };
    }
  };

  const logout = async () => {
    try {
      if (sessionId) {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sessionId }),
        });
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setSessionId("");
      setIsAuthenticated(false);
      localStorage.removeItem("session-id");
    }
  };

  const getAuthHeaders = () => {
    return {
      "Content-Type": "application/json",
      "x-session-id": sessionId,
    };
  };

  return (
    <AuthContext.Provider
      value={{
        sessionId,
        isAuthenticated,
        isLoading,
        login,
        logout,
        getAuthHeaders,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
