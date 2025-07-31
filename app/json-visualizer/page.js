"use client";

import { useState } from "react";

export default function JsonVisualizer() {
  const [jsonInput, setJsonInput] = useState("");
  const [output, setOutput] = useState(null);
  const [error, setError] = useState(null);

  const exampleJson = {
    prompt_instruction_chains: [
      {
        prompt_instruction_text:
          "The system assumes the existence of the cache directory without validating or creating it.",
        related_if_criteria: [
          {
            if_criterion_text:
              "The response validates and creates the cache directory before use.",
            related_acc_criteria: [
              "The response correctly creates a cache directory when missing during initialization.",
            ],
          },
        ],
      },
      {
        prompt_instruction_text: "Prompt instruction with no IF criteria.",
        related_if_criteria: [],
      },
    ],
    unmatched_if_criteria_not_linked_to_prompt: [
      "An orphan IF condition that was not linked.",
    ],
    if_criteria_in_chain_missing_acc_criteria: [
      "The response replaces `eval()` for safe parsing of serialized data.",
      "Another IF criterion in a chain that is missing its Accuracy Criteria.",
    ],
    unmatched_acc_criteria_not_linked_to_if: [
      "An orphan ACC criterion that was not linked.",
      "Another orphan ACC criterion.",
    ],
    prompt_instructions_not_covered_by_if_criteria: [
      "A prompt instruction that is not covered by any IF criteria.",
    ],
  };

  const placeholder = JSON.stringify(exampleJson, null, 2);

  const getFriendlyName = (key) => {
    if (!key) return "Item";

    const nameMap = {
      prompt_instruction_chains: "Prompt Instructions",
      prompt_instruction_text: "Instruction",
      related_if_criteria: "IF Criteria",
      if_criterion_text: "Condition",
      related_acc_criteria: "Accuracy Criteria",
      unmatched_if_criteria_not_linked_to_prompt:
        "IF Criteria that are not linked to Prompt instructions",
      unmatched_acc_criteria_not_linked_to_if:
        "Accuracy Criteria that are not linked to IF Criteria",
      if_criteria_in_chain_missing_acc_criteria:
        "IF Criteria that do not have a matching Accuracy Criteria",
      prompt_instructions_not_covered_by_if_criteria:
        "Prompt instructions that are not covered by IF Criteria",
    };

    return (
      nameMap[key] ||
      key
        .replace(/([A-Z])/g, " $1")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase())
    );
  };

  const handleVisualize = () => {
    setError(null);
    setOutput(null);

    try {
      const parsedJson = JSON.parse(jsonInput);
      if (parsedJson && typeof parsedJson === "object") {
        setOutput(parsedJson);
      } else {
        setError("Invalid JSON: Not an object or array.");
      }
    } catch (e) {
      setError(`Error parsing JSON: ${e.message}`);
    }
  };

  const CollapsibleSection = ({
    title,
    level = 0,
    hasUnmatched = false,
    children,
  }) => {
    const [isOpen, setIsOpen] = useState(true);

    return (
      <details
        open={isOpen}
        className={`level-${level}${
          level === 0 && hasUnmatched ? " unmatched-content" : ""
        }`}
        onToggle={(e) => setIsOpen(e.target.open)}
      >
        <summary>{title}</summary>
        <div className="details-content-wrapper">{children}</div>
      </details>
    );
  };

  const renderList = (items) => (
    <ol className="criteria-list">
      {items.map((item, idx) => (
        <li key={idx}>{item}</li>
      ))}
    </ol>
  );

  const renderGenericData = (data, level = 0) => {
    if (Array.isArray(data)) {
      return data.map((item, idx) => {
        if (typeof item === "object" && item !== null) {
          return (
            <CollapsibleSection
              key={idx}
              title={`Item ${idx + 1}`}
              level={level}
            >
              {renderGenericData(item, level + 1)}
            </CollapsibleSection>
          );
        }
        return <p key={idx}>{item}</p>;
      });
    }

    if (typeof data === "object" && data !== null) {
      return Object.entries(data).map(([key, value]) => {
        if (typeof value === "object" && value !== null) {
          return (
            <CollapsibleSection
              key={key}
              title={getFriendlyName(key)}
              level={level}
            >
              {renderGenericData(value, level + 1)}
            </CollapsibleSection>
          );
        }
        return <p key={key}>{`${getFriendlyName(key)}: ${value}`}</p>;
      });
    }

    return <p>{data}</p>;
  };

  const renderOutput = () => {
    if (error) return <p className="error-message">{error}</p>;
    if (!output)
      return (
        <p>
          Paste your JSON above and click "Visualize JSON" to see the output.
        </p>
      );

    const sections = [];

    // Prompt instruction chains
    if (output.prompt_instruction_chains?.length > 0) {
      sections.push(
        <CollapsibleSection
          key="pic"
          title={`${getFriendlyName("prompt_instruction_chains")} (${
            output.prompt_instruction_chains.length
          })`}
          level={0}
        >
          {output.prompt_instruction_chains.map((chain, idx) => (
            <CollapsibleSection
              key={idx}
              title={chain.prompt_instruction_text || `Instruction ${idx + 1}`}
              level={1}
            >
              {chain.related_if_criteria?.length > 0 && (
                <>
                  <h3 className="criteria-heading">
                    {getFriendlyName("related_if_criteria")}
                  </h3>
                  {chain.related_if_criteria.map((criterion, cidx) => (
                    <CollapsibleSection
                      key={cidx}
                      title={
                        criterion.if_criterion_text || `Condition ${cidx + 1}`
                      }
                      level={2}
                    >
                      <h4 className="criteria-heading">
                        {getFriendlyName("related_acc_criteria")}
                      </h4>
                      {criterion.related_acc_criteria?.length > 0 ? (
                        renderList(criterion.related_acc_criteria)
                      ) : (
                        <p className="no-criteria-text">
                          No Accuracy Criteria defined for this condition.
                        </p>
                      )}
                    </CollapsibleSection>
                  ))}
                </>
              )}
            </CollapsibleSection>
          ))}
        </CollapsibleSection>
      );
    }

    // Unmatched sections
    const unmatchedSections = [
      "unmatched_if_criteria_not_linked_to_prompt",
      "if_criteria_in_chain_missing_acc_criteria",
      "unmatched_acc_criteria_not_linked_to_if",
      "prompt_instructions_not_covered_by_if_criteria",
    ];

    unmatchedSections.forEach((key) => {
      if (output[key] !== undefined && Array.isArray(output[key])) {
        sections.push(
          <CollapsibleSection
            key={key}
            title={`${getFriendlyName(key)} (${output[key].length})`}
            level={0}
            hasUnmatched={output[key].length > 0}
          >
            {output[key].length > 0 ? (
              renderList(output[key])
            ) : (
              <p>No items.</p>
            )}
          </CollapsibleSection>
        );
      }
    });

    // Other data
    const handledKeys = ["prompt_instruction_chains", ...unmatchedSections];
    const otherData = Object.entries(output).filter(
      ([key]) => !handledKeys.includes(key)
    );

    if (otherData.length > 0) {
      sections.push(
        <CollapsibleSection key="other" title="Other Data" level={0}>
          {otherData.map(([key, value]) => (
            <div key={key} className="other-data-item">
              {typeof value === "object" && value !== null ? (
                <CollapsibleSection title={getFriendlyName(key)} level={1}>
                  {renderGenericData(value, 2)}
                </CollapsibleSection>
              ) : (
                `${getFriendlyName(key)}: ${value}`
              )}
            </div>
          ))}
        </CollapsibleSection>
      );
    }

    return sections.length > 0 ? (
      sections
    ) : (
      <p>
        JSON parsed, but no displayable content matched the expected structure
        or the JSON is empty.
      </p>
    );
  };

  return (
    <main className="container">
      <div className="content">
        <h1>JSON Visualizer</h1>

        <label htmlFor="jsonInput">Paste your JSON here:</label>
        <textarea
          id="jsonInput"
          rows="10"
          placeholder={placeholder}
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
        />
        <button
          id="submitJson"
          className="btn primary"
          disabled={!jsonInput.trim()}
          onClick={handleVisualize}
        >
          Visualize JSON
        </button>

        <h2>Visualized Output:</h2>
        <div id="jsonOutput">{renderOutput()}</div>
      </div>
    </main>
  );
}
