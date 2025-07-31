"use client";

import { useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";

export default function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isInitializing, setIsInitializing] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { login } = useAuth();

  // Check if system needs initialization on mount
  useEffect(() => {
    const checkInitStatus = async () => {
      try {
        const response = await fetch("/api/auth/check-init");
        const data = await response.json();

        if (data.needsInit) {
          setIsInitializing(true);
        }
      } catch (error) {
        console.error("Failed to check init status:", error);
        // Default to initialize mode if check fails
        setIsInitializing(true);
      } finally {
        setIsLoading(false);
      }
    };

    checkInitStatus();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!password.trim()) {
      setError("Please enter a password");
      return;
    }

    setIsLoggingIn(true);
    setError("");

    try {
      const result = await login(password);

      if (!result.success) {
        if (result.error.includes("No user found")) {
          // User doesn't exist, offer to initialize
          setIsInitializing(true);
        } else {
          setError(result.error);
        }
      }
    } catch (error) {
      setError("Login failed");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleInitialize = async (e) => {
    e.preventDefault();

    if (!password.trim()) {
      setError("Please enter a password");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    setIsLoggingIn(true);
    setError("");

    try {
      const response = await fetch("/api/auth/init", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Now try to login with the same password
        const loginResult = await login(password);
        if (!loginResult.success) {
          setError(loginResult.error);
        }
      } else {
        setError(data.error);
      }
    } catch (error) {
      setError("Initialization failed");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleCancel = () => {
    setIsInitializing(false);
    setPassword("");
    setError("");
  };

  if (isLoading) {
    return (
      <div className="login-container">
        <div className="login-form">
          <h2>Loading...</h2>
          <p>Checking system status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-form">
        <h2>{isInitializing ? "Initialize System" : "Login"}</h2>
        <p>
          {isInitializing
            ? "No user account found. Please create the initial password for the system."
            : "Please enter your password to access the application."}
        </p>

        <form onSubmit={isInitializing ? handleInitialize : handleLogin}>
          <div className="form-group">
            <label htmlFor="password">Password:</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              minLength={isInitializing ? 8 : undefined}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="form-buttons">
            <button
              type="submit"
              className="login-button"
              disabled={isLoggingIn}
            >
              {isLoggingIn
                ? "Processing..."
                : isInitializing
                ? "Initialize"
                : "Login"}
            </button>

            {isInitializing && (
              <button
                type="button"
                className="cancel-button"
                onClick={handleCancel}
                disabled={isLoggingIn}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
