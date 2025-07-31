"use client";

import Link from "next/link";
import { useAuth } from "./AuthProvider";

export default function Navbar() {
  const { isAuthenticated, logout } = useAuth();

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
          {isAuthenticated && (
            <li className="nav-auth">
              <button onClick={logout} className="logout-button">
                Logout
              </button>
            </li>
          )}
        </ul>
      </div>
    </nav>
  );
}
