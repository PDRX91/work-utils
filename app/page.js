import Link from "next/link";

export default function Home() {
  return (
    <main className="container">
      <div className="content">
        <h1>Welcome to My Work Utilities</h1>
        <p>This is a collection of useful tools and utilities for my work.</p>
        <div className="button-grid">
          <Link href="/copy-steers" className="utility-button">
            Copy Steers
          </Link>
          <Link href="/json-visualizer" className="utility-button">
            Constraint JSON Visualizer
          </Link>
          <Link href="/mass-eval" className="utility-button">
            Mass Evaluation Tool
          </Link>
        </div>
      </div>
    </main>
  );
}
