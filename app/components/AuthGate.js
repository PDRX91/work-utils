"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

export default function AuthGate({ children }) {
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Skip auth for login page
    if (pathname === "/login") {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace(`/login?redirectTo=${encodeURIComponent(pathname)}`);
        return;
      } else {
        // Check TTL stored in localStorage
        const ts = localStorage.getItem("session-timestamp");
        const now = Date.now();
        if (!ts) {
          localStorage.setItem("session-timestamp", now.toString());
          setLoading(false);
        } else if (now - parseInt(ts, 10) > 7 * 24 * 60 * 60 * 1000) {
          // expired
          supabase.auth.signOut();
          router.replace("/login");
        } else {
          setLoading(false);
        }
      }
    });
  }, [pathname]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return <>{children}</>;
}
