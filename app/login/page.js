"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/";

  const ALLOWED_EMAIL = "parker.rebensdorf@contractors.scale.com";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    if (!email) {
      setError("Email is required");
      setLoading(false);
      return;
    }
    if (email !== ALLOWED_EMAIL) {
      setError("Unauthorized email");
      setLoading(false);
      return;
    }

    // Send magic link with dynamic redirect
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}${redirectTo}` },
    });
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }
    setInfo("Magic link sent! Check your email to log in.");
    setLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>Login</h1>
        {error && <div className="error-message">{error}</div>}
        {info && <div className="info-message">{info}</div>}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email:</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <button type="submit" className="login-button" disabled={loading}>
            {loading ? "Sending..." : "Send Magic Link"}
          </button>
        </form>
      </div>
    </div>
  );
}
