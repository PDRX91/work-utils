import Link from "next/link";
import "./globals.css";

export const metadata = {
  title: "Work Utilities",
  description: "A collection of useful tools and utilities for my work",
};

function Navbar() {
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
        </ul>
      </div>
    </nav>
  );
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css"
        />
      </head>
      <body>
        <Navbar />
        {children}
      </body>
    </html>
  );
}
