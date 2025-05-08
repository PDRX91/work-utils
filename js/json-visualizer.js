// Wait for the initial HTML document to be completely loaded and parsed
document.addEventListener("DOMContentLoaded", () => {
  // Get references to the main interactive elements from the DOM
  const submitButton = document.getElementById("submitJson");
  const jsonInputTextarea = document.getElementById("jsonInput");
  const outputDiv = document.getElementById("jsonOutput");

  // Ensure the submit button is disabled by default when the page loads
  // This prevents submission of empty or invalid JSON
  if (submitButton) {
    submitButton.disabled = true;
  }

  // Add an event listener to the JSON input textarea
  // This will enable/disable the submit button based on whether the textarea has content
  if (jsonInputTextarea && submitButton) {
    jsonInputTextarea.addEventListener("input", () => {
      // Disable the button if the textarea, after trimming whitespace, is empty
      submitButton.disabled = jsonInputTextarea.value.trim() === "";
    });
  }

  // Add event listener for the submit button click
  // This handles the core functionality: parsing JSON and building the visual output
  if (submitButton && jsonInputTextarea && outputDiv) {
    submitButton.addEventListener("click", function () {
      // Get the JSON string from the textarea
      const jsonInputString = jsonInputTextarea.value;
      // Clear any previous output from the display area
      outputDiv.innerHTML = "";

      try {
        // Attempt to parse the JSON string into a JavaScript object
        const parsedJson = JSON.parse(jsonInputString);
        // Check if parsing was successful and resulted in an object
        if (parsedJson && typeof parsedJson === "object") {
          // If valid JSON object, proceed to build the visual representation
          buildVisualOutput(parsedJson, outputDiv);
        } else {
          // If parsed content is not an object (e.g., a string, number, or null directly from JSON.parse)
          outputDiv.innerHTML =
            '<p class="error-message">Invalid JSON: Not an object or array.</p>';
        }
      } catch (error) {
        // If JSON.parse throws an error (invalid JSON syntax)
        outputDiv.innerHTML =
          '<p class="error-message">Error parsing JSON: ' +
          error.message +
          "</p>";
      }
    });
  }

  /**
   * Converts a JSON key (string) into a more human-readable friendly name.
   * Handles specific known keys and provides a generic conversion for others.
   * @param {string} key - The JSON key to convert.
   * @returns {string} A user-friendly string representation of the key.
   */
  function getFriendlyName(key) {
    // If the key is null or undefined, return a generic "Item" string
    if (!key) return "Item";

    // Map of specific known keys to their desired friendly names
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
      case "if_criteria_in_chain_missing_acc_criteria":
        return "Unmatched IF Criteria (Not Linked to Accuracy Criteria)";
      default:
        // For unknown keys, convert from snake_case or camelCase to Title Case
        return key
          .replace(/([A-Z])/g, " $1") // Add space before uppercase letters (for camelCase)
          .replace(/_/g, " ") // Replace underscores with spaces (for snake_case)
          .replace(/\b\w/g, (char) => char.toUpperCase()); // Capitalize the first letter of each word
    }
  }

  /**
   * Creates a collapsible HTML <details> section.
   * Each section contains a <summary> (title) and a content wrapper div for animation.
   * @param {string} summaryText - The text to display in the summary (title) of the section.
   * @param {number} [level=0] - The nesting level, used for CSS styling (e.g., indentation).
   * @param {boolean} [hasUnmatched=false] - Flag to add a specific class if the section contains unmatched items.
   * @returns {{details: HTMLElement, contentWrapper: HTMLElement}} An object containing the created <details> element and its content wrapper div.
   */
  function createCollapsibleSection(
    summaryText,
    level = 0,
    hasUnmatched = false
  ) {
    // Create the main <details> HTML element
    const details = document.createElement("details");
    details.open = true; // Set the section to be expanded by default
    details.classList.add(`level-${level}`); // Add class for level-based styling
    // If it's a top-level section and contains unmatched items, add a specific class for styling
    if (level === 0 && hasUnmatched) {
      details.classList.add("unmatched-content");
    }
    // Create the <summary> HTML element (the clickable title part)
    const summary = document.createElement("summary");
    summary.textContent = summaryText; // Set the title text
    details.appendChild(summary); // Add the summary to the details element

    // Create a <div> to wrap the content of the details section; this is used for CSS animations
    const contentWrapper = document.createElement("div");
    contentWrapper.classList.add("details-content-wrapper");
    details.appendChild(contentWrapper); // Add the wrapper to the details element

    // Return both the details element and its content wrapper so content can be added to the wrapper
    return { details, contentWrapper };
  }

  /**
   * Creates an HTML heading element (e.g., <h3>, <h4>).
   * @param {string} text - The text content of the heading.
   * @param {number} [level=3] - The heading level (e.g., 3 for <h3>, 4 for <h4>).
   * @returns {HTMLElement} The created heading element.
   */
  function createHeading(text, level = 3) {
    const heading = document.createElement(`h${level}`); // Create h1, h2, h3 etc. based on level
    heading.textContent = text; // Set the text for the heading
    heading.classList.add("criteria-heading"); // Add a class for styling
    return heading;
  }

  /**
   * Creates an HTML ordered list (<ol>) from an array of string items.
   * @param {string[]} items - An array of strings to be displayed as list items.
   * @returns {HTMLElement} The created <ol> element.
   */
  function createList(items) {
    const ol = document.createElement("ol"); // Create an ordered list element
    ol.classList.add("criteria-list"); // Add a class for styling
    // Iterate over each item in the input array
    items.forEach((itemText) => {
      const li = document.createElement("li"); // Create a list item element
      li.textContent = itemText; // Set the text for the list item
      ol.appendChild(li); // Add the list item to the ordered list
    });
    return ol;
  }

  /**
   * Main function to build the visual HTML structure from the parsed JSON data.
   * It processes specific known keys in the JSON and delegates other keys to a generic renderer.
   * @param {object} jsonData - The parsed JSON data object.
   * @param {HTMLElement} container - The HTML element where the visual output will be appended.
   */
  function buildVisualOutput(jsonData, container) {
    // Variables to hold the container and wrapper for "Other Data" section, created on demand
    let otherDataContainer = null;
    let otherDataWrapper = null;

    // Section 1: Handles "prompt_instruction_chains"
    if (
      jsonData.prompt_instruction_chains &&
      Array.isArray(jsonData.prompt_instruction_chains)
    ) {
      // Create the top-level collapsible section for all prompt instructions
      const { details: picTopSection, contentWrapper: picTopWrapper } =
        createCollapsibleSection(
          getFriendlyName("prompt_instruction_chains") +
            ` (${jsonData.prompt_instruction_chains.length})`, // Display count in title
          0 // Level 0 for top-level section
        );
      // Iterate over each instruction chain in the JSON data
      jsonData.prompt_instruction_chains.forEach((chain, index) => {
        // Determine the title for this specific instruction, fallback to generic if text is missing
        const instructionTitle =
          chain.prompt_instruction_text || `Instruction ${index + 1}`;
        // Create a collapsible section for this individual instruction (level 1)
        const {
          details: instructionSection,
          contentWrapper: instructionWrapper,
        } = createCollapsibleSection(instructionTitle, 1);

        // Check for and process "related_if_criteria" within this instruction
        if (
          chain.related_if_criteria &&
          Array.isArray(chain.related_if_criteria) &&
          chain.related_if_criteria.length > 0
        ) {
          // Add a heading for "IF Criteria" inside the instruction's content wrapper
          instructionWrapper.appendChild(
            createHeading(getFriendlyName("related_if_criteria"), 3) // h3 heading
          );
          // Iterate over each IF criterion
          chain.related_if_criteria.forEach((ifCriterion, ifIndex) => {
            // Determine title for this IF criterion, fallback if text is missing
            const ifCriterionTitle =
              ifCriterion.if_criterion_text || `Condition ${ifIndex + 1}`;
            // Create a collapsible section for this IF criterion (level 2)
            const {
              details: ifCriterionSection,
              contentWrapper: ifCriterionWrapper,
            } = createCollapsibleSection(ifCriterionTitle, 2);

            // Always create and append the "Accuracy Criteria" heading (h4) first
            ifCriterionWrapper.appendChild(
              createHeading(getFriendlyName("related_acc_criteria"), 4)
            );

            // Check for and list the "related_acc_criteria", or show a 'no criteria' message
            if (
              ifCriterion.related_acc_criteria &&
              Array.isArray(ifCriterion.related_acc_criteria) &&
              ifCriterion.related_acc_criteria.length > 0
            ) {
              // If criteria exist, create a list and append it
              ifCriterionWrapper.appendChild(
                createList(ifCriterion.related_acc_criteria)
              );
            } else {
              // If no criteria, or array is empty/malformed, show a message
              const noAccText = document.createElement("p");
              noAccText.textContent =
                "No Accuracy Criteria defined for this condition.";
              noAccText.classList.add("no-criteria-text");
              ifCriterionWrapper.appendChild(noAccText);
            }
            // Add the fully formed IF criterion section to its parent instruction's wrapper
            instructionWrapper.appendChild(ifCriterionSection);
          });
        }
        // Add the fully formed instruction section to the main prompt instructions wrapper
        picTopWrapper.appendChild(instructionSection);
      });
      // If there were any prompt instruction chains, add the entire section to the main output container
      if (jsonData.prompt_instruction_chains.length > 0)
        container.appendChild(picTopSection);
    }

    // Section 2: Handles "unmatched_if_criteria_not_linked_to_prompt"
    if (
      jsonData.unmatched_if_criteria_not_linked_to_prompt &&
      Array.isArray(jsonData.unmatched_if_criteria_not_linked_to_prompt)
    ) {
      // Determine the title for this section, including the count of items
      const unmatchedIfTitle =
        getFriendlyName("unmatched_if_criteria_not_linked_to_prompt") +
        ` (${jsonData.unmatched_if_criteria_not_linked_to_prompt.length})`;
      // Create a collapsible section, flagging if it has content for special styling
      const {
        details: unmatchedIfSection,
        contentWrapper: unmatchedIfWrapper,
      } = createCollapsibleSection(
        unmatchedIfTitle,
        0, // Level 0 for top-level section
        !!jsonData.unmatched_if_criteria_not_linked_to_prompt.length // Boolean flag if items exist
      );
      // If items exist, create a list; otherwise, show a "No items" message
      if (jsonData.unmatched_if_criteria_not_linked_to_prompt.length > 0) {
        unmatchedIfWrapper.appendChild(
          createList(jsonData.unmatched_if_criteria_not_linked_to_prompt)
        );
      } else {
        const p = document.createElement("p");
        p.textContent = "No items.";
        unmatchedIfWrapper.appendChild(p);
      }
      // Add this section to the main output container
      container.appendChild(unmatchedIfSection);
    }

    // Section 3: Handles "if_criteria_in_chain_missing_acc_criteria"
    if (
      jsonData.if_criteria_in_chain_missing_acc_criteria &&
      Array.isArray(jsonData.if_criteria_in_chain_missing_acc_criteria)
    ) {
      const newSectionTitle =
        getFriendlyName("if_criteria_in_chain_missing_acc_criteria") +
        ` (${jsonData.if_criteria_in_chain_missing_acc_criteria.length})`;
      const {
        details: newUnmatchedSection,
        contentWrapper: newUnmatchedWrapper,
      } = createCollapsibleSection(
        newSectionTitle,
        0,
        !!jsonData.if_criteria_in_chain_missing_acc_criteria.length
      );
      if (jsonData.if_criteria_in_chain_missing_acc_criteria.length > 0) {
        newUnmatchedWrapper.appendChild(
          createList(jsonData.if_criteria_in_chain_missing_acc_criteria)
        );
      } else {
        const p = document.createElement("p");
        p.textContent = "No items.";
        newUnmatchedWrapper.appendChild(p);
      }
      container.appendChild(newUnmatchedSection);
    }

    // Section 4: Handles "unmatched_acc_criteria_not_linked_to_if"
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

    // Section 5: Handles all other top-level properties not explicitly processed above
    const handledKeys = [
      "prompt_instruction_chains",
      "unmatched_if_criteria_not_linked_to_prompt",
      "if_criteria_in_chain_missing_acc_criteria",
      "unmatched_acc_criteria_not_linked_to_if",
    ]; // Array of keys already handled by specific sections
    // Iterate over all keys in the root of the JSON data
    for (const key in jsonData) {
      // Ensure the key is a direct property of the object and not in the handledKeys list
      if (jsonData.hasOwnProperty(key) && !handledKeys.includes(key)) {
        // If the "Other Data" section hasn't been created yet, create it now
        if (!otherDataContainer) {
          const { details: odContainer, contentWrapper: odWrapper } =
            createCollapsibleSection("Other Data", 0); // Top-level section for miscellaneous data
          otherDataContainer = odContainer;
          otherDataWrapper = odWrapper; // Store the wrapper for appending items
          container.appendChild(otherDataContainer); // Add to main output
        }
        const value = jsonData[key]; // Get the value for the current key
        const itemDiv = document.createElement("div"); // Create a div for this key-value pair
        itemDiv.classList.add("other-data-item"); // Add styling class
        // If the value is an object or array, recursively call buildGenericVisual to render it as a sub-section
        if (typeof value === "object" && value !== null) {
          const { details: subSection, contentWrapper: subSectionWrapper } =
            createCollapsibleSection(getFriendlyName(key), 1); // Create a sub-section (level 1)
          buildGenericVisual(value, subSectionWrapper, 2); // Recursively build content, starting at next level (2)
          itemDiv.appendChild(subSection); // Add the sub-section to the itemDiv
        } else {
          // If the value is a primitive, display it as "Key: Value"
          itemDiv.textContent = `${getFriendlyName(key)}: ${value}`;
        }
        // Add the fully formed item (key-value pair or sub-section) to the "Other Data" wrapper
        otherDataWrapper.appendChild(itemDiv);
      }
    }

    // If, after all processing, the main output container is still empty, display a message
    if (container.children.length === 0) {
      container.innerHTML =
        "<p>JSON parsed, but no displayable content matched the expected structure or the JSON is empty.</p>";
    }
  }

  /**
   * Recursively builds a visual representation for generic JavaScript objects or arrays.
   * Used for parts of the JSON that don't have specific rendering logic in buildVisualOutput (e.g., content of "Other Data").
   * @param {object|Array} data - The object or array to render.
   * @param {HTMLElement} parentContentWrapper - The content wrapper of the parent <details> element where this visual will be appended.
   * @param {number} level - The current nesting level for styling and creating sub-sections.
   */
  function buildGenericVisual(data, parentContentWrapper, level) {
    // Check if the current data is an array
    if (Array.isArray(data)) {
      // Iterate over each item in the array
      data.forEach((item, index) => {
        // If the array item is an object or another array, create a collapsible sub-section for it
        if (typeof item === "object" && item !== null) {
          const { details: arrItemSection, contentWrapper: arrItemWrapper } =
            createCollapsibleSection(`Item ${index + 1}`, level); // Title uses array index
          buildGenericVisual(item, arrItemWrapper, level + 1); // Recursive call for the item's content
          parentContentWrapper.appendChild(arrItemSection); // Append to parent wrapper
        } else {
          // If the array item is a primitive, display it directly in a <p> tag
          const p = document.createElement("p");
          p.textContent = item;
          parentContentWrapper.appendChild(p);
        }
      });
    } else {
      // If the current data is an object (not an array)
      // Iterate over each key-value pair in the object
      for (const key in data) {
        if (data.hasOwnProperty(key)) {
          const value = data[key];
          // If the value is an object or array, create a collapsible sub-section for it
          if (typeof value === "object" && value !== null) {
            const { details: objPropSection, contentWrapper: objPropWrapper } =
              createCollapsibleSection(getFriendlyName(key), level); // Title uses the friendly key name
            buildGenericVisual(value, objPropWrapper, level + 1); // Recursive call for the value's content
            parentContentWrapper.appendChild(objPropSection); // Append to parent wrapper
          } else {
            // If the value is a primitive, display it as "Key: Value" in a <p> tag
            const p = document.createElement("p");
            p.textContent = `${getFriendlyName(key)}: ${value}`;
            parentContentWrapper.appendChild(p);
          }
        }
      }
    }
  }

  // Setup example JSON in the textarea when the page loads for easy testing
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
      if_criteria_in_chain_missing_acc_criteria: [
        "The response replaces `eval()` for safe parsing of serialized data.",
        "Another IF criterion in a chain that is missing its Accuracy Criteria.",
      ],
      unmatched_acc_criteria_not_linked_to_if: [
        "An orphan ACC criterion that was not linked.",
        "Another orphan ACC criterion.",
      ],
    };
    // Set the value of the textarea to the stringified example JSON, pretty-printed with 2 spaces
    jsonInputTextarea.value = JSON.stringify(exampleJson, null, 2);
    // Dispatch an 'input' event to trigger the event listener that enables/disables the submit button
    const event = new Event("input", { bubbles: true, cancelable: true });
    jsonInputTextarea.dispatchEvent(event);
  }
});
