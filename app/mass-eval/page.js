"use client";

import { useState, useEffect } from "react";
import toolSchema from "@/data/agent-completion-grader-tool-schema.json"; // full schema

export default function MassEval() {
  const [model, setModel] = useState("openai/gpt-5");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [savedSystemPrompt, setSavedSystemPrompt] = useState("");
  const [rulesList, setRulesList] = useState([]);
  const [savedRulesList, setSavedRulesList] = useState([]);
  const [prompt, setPrompt] = useState(
    "Please grade the following content based on the rules described in the system prompt."
  );
  const [content, setContent] = useState("");
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [responseType, setResponseType] = useState("");

  // Collapsible section states
  const [isSystemPromptCollapsed, setIsSystemPromptCollapsed] = useState(false);
  const [isRulesListCollapsed, setIsRulesListCollapsed] = useState(false);
  const [isPromptCollapsed, setIsPromptCollapsed] = useState(false);
  const [isContentCollapsed, setIsContentCollapsed] = useState(false);

  // Load stored data on mount
  useEffect(() => {
    const storedModel = localStorage.getItem("mass-eval-model");
    const storedPrompt = localStorage.getItem("mass-eval-prompt");
    const storedContent = localStorage.getItem("mass-eval-content");

    if (storedModel) setModel(storedModel);
    if (storedPrompt) setPrompt(storedPrompt);
    if (storedContent) setContent(storedContent);
    loadSystemPromptAndRules();
  }, []);

  // Save to localStorage when model or prompt changes
  useEffect(() => {
    localStorage.setItem("mass-eval-model", model);
  }, [model]);

  useEffect(() => {
    localStorage.setItem("mass-eval-prompt", prompt);
  }, [prompt]);

  useEffect(() => {
    localStorage.setItem("mass-eval-content", content);
  }, [content]);

  const loadSystemPromptAndRules = async () => {
    try {
      const response = await fetch("/api/system-prompt");
      if (response.ok) {
        const data = await response.json();
        setSystemPrompt(data.systemPrompt || "");
        setSavedSystemPrompt(data.systemPrompt || "");
        setRulesList(data.rulesList || []);
        setSavedRulesList(data.rulesList || []);
      } else {
        console.error(
          "Failed to load system prompt/rules:",
          response.status,
          response.statusText
        );
      }
    } catch (error) {
      console.error("Error loading system prompt/rules:", error);
    }
  };

  const saveSystemPromptAndRules = async () => {
    try {
      const response = await fetch("/api/system-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt, rulesList }),
      });

      if (response.ok) {
        setSavedSystemPrompt(systemPrompt);
        setSavedRulesList(rulesList);
        showSuccess("System prompt and rules saved successfully!");
      } else {
        showError("Failed to save system prompt/rules");
      }
    } catch (error) {
      console.error("Error saving system prompt/rules:", error);
      showError("Error saving system prompt/rules");
    }
  };

  const discardSystemPromptAndRules = () => {
    setSystemPrompt(savedSystemPrompt);
    setRulesList(savedRulesList);
  };

  const showSuccess = (message) => {
    setResponseType("success");
    setResponse(message);
  };

  const showError = (message) => {
    setResponseType("error");
    setResponse(message);
  };

  // Extract tool names from conversation JSON
  const extractToolNames = (conversation) => {
    const toolNames = new Set();
    conversation.forEach((turn) => {
      if (turn.role === "assistant" && turn.tool_call) {
        toolNames.add(turn.tool_call.name);
      }
    });
    return Array.from(toolNames);
  };

  // Map tool names to categories and return subset schema
  const getToolSubset = (conversation) => {
    const toolNames = extractToolNames(conversation);
    const subset = {};

    for (const [category, tools] of Object.entries(toolSchema.tools)) {
      const matchingTools = tools.filter((tool) =>
        toolNames.includes(tool.name)
      );
      if (matchingTools.length > 0) {
        subset[category] = matchingTools;
      }
    }
    return subset;
  };

  const evaluateContent = async () => {
    if (isLoading) return;

    if (!model) {
      showError("Please select a model");
      return;
    }
    if (!prompt.trim()) {
      showError("Please enter a prompt");
      return;
    }
    if (!content.trim()) {
      showError("Please enter content to evaluate");
      return;
    }

    let conversation;
    try {
      conversation = JSON.parse(content);
    } catch (err) {
      showError("Content must be valid JSON representing the conversation");
      return;
    }

    const subsetSchema = getToolSubset(conversation);

    setIsLoading(true);
    setResponseType("loading");
    setResponse("");

    try {
      const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          systemPrompt: systemPrompt.trim(),
          rulesList,
          prompt: `${prompt}\n\nContent to evaluate:\n${JSON.stringify(
            conversation,
            null,
            2
          )}`,
          toolSchemaSubset: subsetSchema,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `HTTP ${response.status}: ${response.statusText}`
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";

      setResponseType("success");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        fullResponse += chunk;
        setResponse(fullResponse);
      }
    } catch (error) {
      console.error("Evaluation error:", error);
      showError(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const hasChanges =
    systemPrompt !== savedSystemPrompt ||
    JSON.stringify(rulesList) !== JSON.stringify(savedRulesList);

  return (
    <div className="container">
      <h1>Mass Evaluation Tool (Grader Version)</h1>

      <div className="eval-container">
        <div className="config-section">
          <div className="form-group">
            <label htmlFor="model-select">Model:</label>
            <select
              id="model-select"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              <option value="openai/gpt-5">GPT-5</option>
              <option value="openai/gpt-5-mini">GPT-5 Mini</option>
              <option value="openai/o4-mini-high">GPT-o4 Mini High</option>
              <option value="openai/o4-mini">GPT-o4 Mini</option>
              <option value="openai/gpt-oss-120b">GPT-OSS-120B</option>
              <option value="openai/gpt-oss-20b">GPT-OSS-20B</option>
              <option value="openai/o3">GPT-o3</option>
              <option value="anthropic/claude-3.7-sonnet">
                Claude 3.7 Sonnet
              </option>
              <option value="anthropic/claude-sonnet-4">Claude Sonnet 4</option>
              <option value="anthropic/claude-opus-4.1">
                Claude Opus 4.1 (VERY EXPENSIVE)
              </option>
              <option value="google/gemini-2.5-flash">Gemini 2.5 Flash</option>
              <option value="google/gemini-2.5-pro">Gemini 2.5 Pro</option>
              <option value="deepseek/deepseek-r1-0528:free">
                Deepseek R1
              </option>
            </select>
          </div>
        </div>

        <div className="collapsible-section">
          <div
            className="section-header"
            onClick={() => setIsSystemPromptCollapsed(!isSystemPromptCollapsed)}
          >
            <h3>
              System Prompt
              <span
                className={`collapse-indicator ${
                  isSystemPromptCollapsed ? "collapsed" : ""
                }`}
              >
                ▼
              </span>
            </h3>
          </div>
          {!isSystemPromptCollapsed && (
            <div className="section-content">
              <div className="form-group">
                <textarea
                  id="system-prompt"
                  rows="3"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                />
              </div>
              <div className="system-prompt-buttons">
                <button
                  disabled={!hasChanges}
                  onClick={saveSystemPromptAndRules}
                >
                  Save Changes
                </button>
                <button
                  disabled={!hasChanges}
                  onClick={discardSystemPromptAndRules}
                >
                  Discard Changes
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="collapsible-section">
          <div
            className="section-header"
            onClick={() => setIsRulesListCollapsed(!isRulesListCollapsed)}
          >
            <h3>
              Rules List (JSON)
              <span
                className={`collapse-indicator ${
                  isRulesListCollapsed ? "collapsed" : ""
                }`}
              >
                ▼
              </span>
            </h3>
          </div>
          {!isRulesListCollapsed && (
            <div className="section-content">
              <div className="form-group">
                <textarea
                  id="rules-list"
                  rows="6"
                  value={JSON.stringify(rulesList, null, 2)}
                  onChange={(e) => {
                    try {
                      setRulesList(JSON.parse(e.target.value));
                    } catch {
                      // ignore invalid JSON while typing
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="collapsible-section">
          <div
            className="section-header"
            onClick={() => setIsPromptCollapsed(!isPromptCollapsed)}
          >
            <h3>
              Prompt
              <span
                className={`collapse-indicator ${
                  isPromptCollapsed ? "collapsed" : ""
                }`}
              >
                ▼
              </span>
            </h3>
          </div>
          {!isPromptCollapsed && (
            <div className="section-content">
              <div className="form-group">
                <textarea
                  id="prompt-input"
                  rows="6"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <div className="collapsible-section">
          <div
            className="section-header"
            onClick={() => setIsContentCollapsed(!isContentCollapsed)}
          >
            <h3>
              Content to Evaluate (JSON)
              <span
                className={`collapse-indicator ${
                  isContentCollapsed ? "collapsed" : ""
                }`}
              >
                ▼
              </span>
            </h3>
          </div>
          {!isContentCollapsed && (
            <div className="section-content">
              <div className="form-group">
                <div className="textarea-with-button">
                  <textarea
                    id="content-input"
                    rows="8"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                  {content.trim() && (
                    <button
                      type="button"
                      className="clear-button"
                      onClick={() => setContent("")}
                      title="Clear content"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="evaluate-button-section">
          <button
            className="evaluate-button"
            onClick={evaluateContent}
            disabled={isLoading}
          >
            {isLoading ? "Grading..." : "Grade Content"}
          </button>
        </div>

        <div className="response-section">
          <div className="form-group">
            <label>Response:</label>
            <div className="response-area">
              {responseType === "loading" && <div>Evaluating content...</div>}
              {responseType === "success" && <div>{response}</div>}
              {responseType === "error" && (
                <div className="error">{response}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
