"use client";

import { useState, useEffect } from "react";

export default function CopySteers() {
  const [checkboxes, setCheckboxes] = useState({
    "steer-toggle-1": false,
    "steer-toggle-2": false,
    "steer-toggle-3": false,
    "steer-toggle-4": false,
    "steer-toggle-5": false,
    "steer-toggle-6": false,
    "steer-toggle-7": false,
    "steer-toggle-8": false,
    "steer-toggle-9": false,
    "steer-toggle-10": false,
  });

  const [showNotification, setShowNotification] = useState(false);

  const labels = {
    "steer-toggle-1": "General Steerability - Content Style Instructions",
    "steer-toggle-2": "General Steerability - Compositional Instruction",
    "steer-toggle-3": "General Steerability - Instruction Compliance Policy",
    "steer-toggle-4": "General Steerability - Instruction Source",
    "steer-toggle-5": "Tone Steerability - Implicit",
    "steer-toggle-6": "Tone Steerability - Explicit",
    "steer-toggle-7":
      "Formatting Steerability - Format Content With Specific Format Types",
    "steer-toggle-8":
      "Formatting Steerability - Format Content in Specific Document Formats",
    "steer-toggle-9":
      "Formatting Steerability - Follow Formatting Style Guides",
    "steer-toggle-10":
      "Formatting Steerability - Follow Language-Specific Formatting",
  };

  const handleCheckboxChange = (id) => {
    setCheckboxes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleReset = () => {
    setCheckboxes(
      Object.keys(checkboxes).reduce(
        (acc, key) => ({ ...acc, [key]: false }),
        {}
      )
    );
  };

  const handleCopy = async () => {
    const results = Object.entries(checkboxes)
      .map(([id, checked]) => {
        const status = checked ? "YES" : "NO";
        return `${status} - ${labels[id]}`;
      })
      .join("\n");

    try {
      await navigator.clipboard.writeText(results);
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 2000);
    } catch (err) {
      console.error("Failed to copy: ", err);
    }
  };

  return (
    <div className="container">
      <h1>Steers Maker</h1>

      {Object.entries(labels).map(([id, label]) => (
        <div key={id}>
          <input
            type="checkbox"
            id={id}
            checked={checkboxes[id]}
            onChange={() => handleCheckboxChange(id)}
          />
          <label htmlFor={id}>{label}</label>
        </div>
      ))}

      <div className="display-area" id="results">
        {Object.entries(checkboxes).map(([id, checked]) => (
          <div key={id} className="result-item">
            <span className={checked ? "yes" : "no"}>
              {checked ? "YES" : "NO"}
            </span>{" "}
            - {labels[id]}
          </div>
        ))}
      </div>

      <div className="button-container">
        <button onClick={handleReset} className="danger">
          Reset All
        </button>
        <button onClick={handleCopy} className="info">
          <i className="fas fa-copy"></i> Copy Results
        </button>
      </div>

      <div
        className={`notification ${showNotification ? "show" : ""}`}
        id="notification"
      >
        Copied to clipboard!
      </div>
    </div>
  );
}
