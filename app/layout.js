import "./globals.css";
import Navbar from "./components/Navbar";
import AuthGate from "./components/AuthGate";

export const metadata = {
  title: "Work Utilities",
  description: "A collection of useful tools and utilities for my work",
};

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
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
