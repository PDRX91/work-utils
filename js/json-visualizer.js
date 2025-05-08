document.addEventListener("DOMContentLoaded", () => {
  const submitButton = document.getElementById("submitJson");
  const jsonInputTextarea = document.getElementById("jsonInput");
  const outputDiv = document.getElementById("jsonOutput");

  // Ensure the button is disabled initially
  if (submitButton) {
    submitButton.disabled = true;
  }

  // Add event listener to the textarea to enable/disable the button
  if (jsonInputTextarea && submitButton) {
    jsonInputTextarea.addEventListener("input", () => {
      submitButton.disabled = jsonInputTextarea.value.trim() === "";
    });
  }

  if (submitButton && jsonInputTextarea && outputDiv) {
    submitButton.addEventListener("click", function () {
      const jsonInputString = jsonInputTextarea.value;
      outputDiv.innerHTML = ""; // Clear previous output

      try {
        const parsedJson = JSON.parse(jsonInputString);
        if (parsedJson && typeof parsedJson === "object") {
          buildVisualOutput(parsedJson, outputDiv);
        } else {
          outputDiv.innerHTML =
            '<p class="error-message">Invalid JSON: Not an object or array.</p>';
        }
      } catch (error) {
        outputDiv.innerHTML =
          '<p class="error-message">Error parsing JSON: ' +
          error.message +
          "</p>";
      }
    });
  }

  function getFriendlyName(key) {
    if (!key) return "Item";
    // Convert snake_case and camelCase to Title Case, and handle specific known keys
    switch (key) {
      case "prompt_instruction_chains":
        return "Prompt Instructions";
      case "prompt_instruction_text":
        return "Instruction";
      case "related_if_criteria":
        return "IF Criteria";
      case "if_criterion_text":
        return "Condition";
      case "related_acc_criteria":
        return "Accuracy Criteria";
      case "unmatched_if_criteria_not_linked_to_prompt":
        return "Unmatched IF Criteria (Not Linked to Prompt)";
      case "unmatched_acc_criteria_not_linked_to_if":
        return "Unmatched Accuracy Criteria (Not Linked to IF Criteria)";
      default:
        return key
          .replace(/([A-Z])/g, " $1") // camelCase to Title Case
          .replace(/_/g, " ") // snake_case to spaces
          .replace(/\b\w/g, (char) => char.toUpperCase()); // Capitalize first letter of each word
    }
  }

  function createCollapsibleSection(
    summaryText,
    level = 0,
    hasUnmatched = false
  ) {
    const details = document.createElement("details");
    details.open = true; // Expand by default
    details.classList.add(`level-${level}`);
    if (level === 0 && hasUnmatched) {
      details.classList.add("unmatched-content");
    }
    const summary = document.createElement("summary");
    summary.textContent = summaryText;
    details.appendChild(summary);

    // Add the content wrapper for animation
    const contentWrapper = document.createElement("div");
    contentWrapper.classList.add("details-content-wrapper");
    details.appendChild(contentWrapper);

    return { details, contentWrapper }; // Return both for appending content
  }

  function createHeading(text, level = 3) {
    const heading = document.createElement(`h${level}`);
    heading.textContent = text;
    heading.classList.add("criteria-heading");
    return heading;
  }

  function createList(items) {
    const ul = document.createElement("ol");
    ul.classList.add("criteria-list");
    items.forEach((itemText) => {
      const li = document.createElement("li");
      li.textContent = itemText;
      ul.appendChild(li);
    });
    return ul;
  }

  function buildVisualOutput(jsonData, container) {
    let otherDataContainer = null;
    let otherDataWrapper = null; // Wrapper for otherData section content

    // 1. Prompt Instructions section
    if (
      jsonData.prompt_instruction_chains &&
      Array.isArray(jsonData.prompt_instruction_chains)
    ) {
      const { details: picTopSection, contentWrapper: picTopWrapper } =
        createCollapsibleSection(
          getFriendlyName("prompt_instruction_chains") +
            ` (${jsonData.prompt_instruction_chains.length})`,
          0
        );
      jsonData.prompt_instruction_chains.forEach((chain, index) => {
        const instructionTitle =
          chain.prompt_instruction_text || `Instruction ${index + 1}`;
        const {
          details: instructionSection,
          contentWrapper: instructionWrapper,
        } = createCollapsibleSection(instructionTitle, 1);

        if (
          chain.related_if_criteria &&
          Array.isArray(chain.related_if_criteria) &&
          chain.related_if_criteria.length > 0
        ) {
          instructionWrapper.appendChild(
            createHeading(getFriendlyName("related_if_criteria"), 3)
          );
          chain.related_if_criteria.forEach((ifCriterion, ifIndex) => {
            const ifCriterionTitle =
              ifCriterion.if_criterion_text || `Condition ${ifIndex + 1}`;
            const {
              details: ifCriterionSection,
              contentWrapper: ifCriterionWrapper,
            } = createCollapsibleSection(ifCriterionTitle, 2);

            if (
              ifCriterion.related_acc_criteria &&
              Array.isArray(ifCriterion.related_acc_criteria) &&
              ifCriterion.related_acc_criteria.length > 0
            ) {
              ifCriterionWrapper.appendChild(
                createHeading(getFriendlyName("related_acc_criteria"), 4)
              );
              ifCriterionWrapper.appendChild(
                createList(ifCriterion.related_acc_criteria)
              );
            } else if (ifCriterion.related_acc_criteria) {
              const noAccText = document.createElement("p");
              noAccText.textContent =
                "No Accuracy Criteria defined for this condition.";
              noAccText.classList.add("no-criteria-text");
              ifCriterionWrapper.appendChild(noAccText);
            }
            instructionWrapper.appendChild(ifCriterionSection); // Append the whole <details> for IF criterion
          });
        }
        picTopWrapper.appendChild(instructionSection); // Append the whole <details> for instruction
      });
      if (jsonData.prompt_instruction_chains.length > 0)
        container.appendChild(picTopSection);
    }

    // 2. Unmatched IF Criteria
    if (
      jsonData.unmatched_if_criteria_not_linked_to_prompt &&
      Array.isArray(jsonData.unmatched_if_criteria_not_linked_to_prompt)
    ) {
      const unmatchedIfTitle =
        getFriendlyName("unmatched_if_criteria_not_linked_to_prompt") +
        ` (${jsonData.unmatched_if_criteria_not_linked_to_prompt.length})`;
      const {
        details: unmatchedIfSection,
        contentWrapper: unmatchedIfWrapper,
      } = createCollapsibleSection(
        unmatchedIfTitle,
        0,
        !!jsonData.unmatched_if_criteria_not_linked_to_prompt.length
      );
      if (jsonData.unmatched_if_criteria_not_linked_to_prompt.length > 0) {
        unmatchedIfWrapper.appendChild(
          createList(jsonData.unmatched_if_criteria_not_linked_to_prompt)
        );
      } else {
        const p = document.createElement("p");
        p.textContent = "No items.";
        unmatchedIfWrapper.appendChild(p);
      }
      container.appendChild(unmatchedIfSection);
    }

    // 3. Unmatched Accuracy Criteria
    if (
      jsonData.unmatched_acc_criteria_not_linked_to_if &&
      Array.isArray(jsonData.unmatched_acc_criteria_not_linked_to_if)
    ) {
      const unmatchedAccTitle =
        getFriendlyName("unmatched_acc_criteria_not_linked_to_if") +
        ` (${jsonData.unmatched_acc_criteria_not_linked_to_if.length})`;
      const {
        details: unmatchedAccSection,
        contentWrapper: unmatchedAccWrapper,
      } = createCollapsibleSection(
        unmatchedAccTitle,
        0,
        !!jsonData.unmatched_acc_criteria_not_linked_to_if.length
      );
      if (jsonData.unmatched_acc_criteria_not_linked_to_if.length > 0) {
        unmatchedAccWrapper.appendChild(
          createList(jsonData.unmatched_acc_criteria_not_linked_to_if)
        );
      } else {
        const p = document.createElement("p");
        p.textContent = "No items.";
        unmatchedAccWrapper.appendChild(p);
      }
      container.appendChild(unmatchedAccSection);
    }

    // 4. Other top-level properties
    const handledKeys = [
      "prompt_instruction_chains",
      "unmatched_if_criteria_not_linked_to_prompt",
      "unmatched_acc_criteria_not_linked_to_if",
    ];
    for (const key in jsonData) {
      if (jsonData.hasOwnProperty(key) && !handledKeys.includes(key)) {
        if (!otherDataContainer) {
          // Create the main "Other Data" collapsible section only once
          const { details: odContainer, contentWrapper: odWrapper } =
            createCollapsibleSection("Other Data", 0);
          otherDataContainer = odContainer;
          otherDataWrapper = odWrapper; // This is the wrapper where items will go
          container.appendChild(otherDataContainer);
        }
        const value = jsonData[key];
        const itemDiv = document.createElement("div");
        itemDiv.classList.add("other-data-item");
        if (typeof value === "object" && value !== null) {
          // For nested objects/arrays within "Other Data", they become their own collapsible sections
          const { details: subSection, contentWrapper: subSectionWrapper } =
            createCollapsibleSection(getFriendlyName(key), 1);
          buildGenericVisual(value, subSectionWrapper, 2); // Pass the wrapper to buildGenericVisual
          itemDiv.appendChild(subSection);
        } else {
          itemDiv.textContent = `${getFriendlyName(key)}: ${value}`;
        }
        otherDataWrapper.appendChild(itemDiv); // Append to the content wrapper of "Other Data"
      }
    }

    if (container.children.length === 0) {
      container.innerHTML =
        "<p>JSON parsed, but no displayable content matched the expected structure or the JSON is empty.</p>";
    }
  }

  function buildGenericVisual(data, parentContentWrapper, level) {
    // Expects parent's contentWrapper
    if (Array.isArray(data)) {
      data.forEach((item, index) => {
        if (typeof item === "object" && item !== null) {
          const { details: arrItemSection, contentWrapper: arrItemWrapper } =
            createCollapsibleSection(`Item ${index + 1}`, level);
          buildGenericVisual(item, arrItemWrapper, level + 1);
          parentContentWrapper.appendChild(arrItemSection);
        } else {
          const p = document.createElement("p");
          p.textContent = item;
          // p.style.paddingLeft = `${level * 10}px`; // CSS handles indentation now via wrapper
          parentContentWrapper.appendChild(p);
        }
      });
    } else {
      // Is an object
      for (const key in data) {
        if (data.hasOwnProperty(key)) {
          const value = data[key];
          if (typeof value === "object" && value !== null) {
            const { details: objPropSection, contentWrapper: objPropWrapper } =
              createCollapsibleSection(getFriendlyName(key), level);
            buildGenericVisual(value, objPropWrapper, level + 1);
            parentContentWrapper.appendChild(objPropSection);
          } else {
            const p = document.createElement("p");
            p.textContent = `${getFriendlyName(key)}: ${value}`;
            // p.style.paddingLeft = `${level * 10}px`; // CSS handles indentation now via wrapper
            parentContentWrapper.appendChild(p);
          }
        }
      }
    }
  }

  // Example JSON (ensure it has all parts to test the new structure)
  if (jsonInputTextarea) {
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
            {
              if_criterion_text:
                "Another IF criterion for the first instruction.",
              related_acc_criteria: [
                "ACC 1 for another IF.",
                "ACC 2 for another IF.",
              ],
            },
          ],
        },
        {
          prompt_instruction_text:
            "Exception handling uses a blanket except Exception clause.",
          related_if_criteria: [
            {
              if_criterion_text: "The response replaces the blanket clause.",
              related_acc_criteria: ["The response logs full error details."],
            },
          ],
        },
        {
          prompt_instruction_text: "Instruction with no IF criteria.",
          related_if_criteria: [], // Ensure this is a valid empty array
        },
      ],
      unmatched_if_criteria_not_linked_to_prompt: [
        "An orphan IF condition that was not linked.",
      ],
      unmatched_acc_criteria_not_linked_to_if: [
        "An orphan ACC criterion that was not linked.",
        "Another orphan ACC criterion.",
      ],
    };
    jsonInputTextarea.placeholder = JSON.stringify(exampleJson, null, 2);
    const event = new Event("input", { bubbles: true, cancelable: true });
    jsonInputTextarea.dispatchEvent(event);
  }
});
