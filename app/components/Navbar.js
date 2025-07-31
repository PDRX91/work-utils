"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

export default function Navbar() {
  const [session, setSession] = useState(null);
  const router = useRouter();

  useEffect(() => {
    // Get and listen for auth state changes
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => setSession(session));
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );
    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const navItems = [
    { name: "Home", href: "/" },
    { name: "Copy Steers", href: "/copy-steers" },
    { name: "JSON Visualizer", href: "/json-visualizer" },
    { name: "Mass Eval", href: "/mass-eval" },
  ];

  return (
    <nav className="navbar">
      <div className="container">
        <ul className="nav-links">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link href={item.href}>{item.name}</Link>
            </li>
          ))}
          {session && (
            <li className="nav-auth">
              <button
                onClick={handleLogout}
                className="logout-button button danger"
              >
                Logout
              </button>
            </li>
          )}
        </ul>
      </div>
    </nav>
  );
}
