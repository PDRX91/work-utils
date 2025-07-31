"use client";

import { useState, useEffect } from "react";

export default function MassEval() {
  const [model, setModel] = useState("openai/gpt-4o-mini");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [savedSystemPrompt, setSavedSystemPrompt] = useState("");
  const [prompt, setPrompt] = useState("");
  const [content, setContent] = useState("");
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [responseType, setResponseType] = useState(""); // 'success', 'error', 'loading'

  // Load stored data on mount
  useEffect(() => {
    const storedModel = localStorage.getItem("mass-eval-model");
    const storedPrompt = localStorage.getItem("mass-eval-prompt");

    if (storedModel) setModel(storedModel);
    if (storedPrompt) setPrompt(storedPrompt);

    // Load system prompt from API
    loadSystemPrompt();
  }, []);

  // Save to localStorage when model or prompt changes
  useEffect(() => {
    localStorage.setItem("mass-eval-model", model);
  }, [model]);

  useEffect(() => {
    localStorage.setItem("mass-eval-prompt", prompt);
  }, [prompt]);

  const loadSystemPrompt = async () => {
    try {
      const response = await fetch("/api/system-prompt");
      if (response.ok) {
        const data = await response.json();
        const promptText = data.systemPrompt || "";
        setSystemPrompt(promptText);
        setSavedSystemPrompt(promptText);
      } else {
        console.error(
          "Failed to load system prompt:",
          response.status,
          response.statusText
        );
      }
    } catch (error) {
      console.error("Error loading system prompt:", error);
    }
  };

  const saveSystemPrompt = async () => {
    try {
      const response = await fetch("/api/system-prompt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ systemPrompt }),
      });

      if (response.ok) {
        setSavedSystemPrompt(systemPrompt);
        showSuccess("System prompt saved successfully!");
      } else {
        console.error("Failed to save system prompt");
        showError("Failed to save system prompt");
      }
    } catch (error) {
      console.error("Error saving system prompt:", error);
      showError("Error saving system prompt");
    }
  };

  const discardSystemPrompt = () => {
    setSystemPrompt(savedSystemPrompt);
  };

  const showSuccess = (message) => {
    setResponseType("success");
    setResponse(message);
  };

  const showError = (message) => {
    setResponseType("error");
    setResponse(message);
  };

  const evaluateContent = async () => {
    if (isLoading) return;

    // Validation
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

    setIsLoading(true);
    setResponseType("loading");
    setResponse("");

    try {
      const fullPrompt = `${prompt}\n\nContent to evaluate:\n${content}`;

      const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          systemPrompt: systemPrompt.trim(),
          prompt: fullPrompt,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `HTTP ${response.status}: ${response.statusText}`
        );
      }

      // Handle streaming response
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

  const hasSystemPromptChanges = systemPrompt !== savedSystemPrompt;

  return (
    <div className="container">
      <h1>Mass Evaluation Tool</h1>

      <div className="eval-container">
        <div className="config-section">
          <div className="form-group">
            <label htmlFor="model-select">Model:</label>
            <select
              id="model-select"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              <option value="openai/o4-mini">GPT-o4 Mini</option>
              <option value="openai/o4-mini-high">GPT-o4 Mini High</option>
              <option value="openai/o3">GPT-o3</option>
              <option value="anthropic/claude-3.7-sonnet">
                Claude 3.7 Sonnet
              </option>
              <option value="anthropic/claude-sonnet-4">Claude Sonnet 4</option>
              <option value="google/gemini-2.5-flash">Gemini 2.5 Flash</option>
              <option value="google/gemini-2.5-pro">Gemini 2.5 Pro</option>
              <option value="deepseek/deepseek-r1-0528:free">
                Deepseek R1
              </option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="system-prompt">System Prompt:</label>
            <textarea
              id="system-prompt"
              placeholder="Enter a system prompt to guide the AI's behavior..."
              rows="3"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
            />
            <div className="system-prompt-buttons">
              <button
                id="save-system-prompt"
                className="save-button"
                disabled={!hasSystemPromptChanges}
                onClick={saveSystemPrompt}
              >
                Save Changes
              </button>
              <button
                id="discard-system-prompt"
                className="discard-button"
                disabled={!hasSystemPromptChanges}
                onClick={discardSystemPrompt}
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>

        <div className="input-section">
          <div className="form-group">
            <label htmlFor="prompt-input">Prompt:</label>
            <textarea
              id="prompt-input"
              placeholder="Enter your evaluation prompt here..."
              rows="6"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="content-input">Content to Evaluate:</label>
            <textarea
              id="content-input"
              placeholder="Enter the content you want to evaluate..."
              rows="8"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          <button
            id="evaluate-btn"
            className="evaluate-button"
            onClick={evaluateContent}
            disabled={isLoading}
          >
            {isLoading ? "Evaluating..." : "Evaluate Content"}
          </button>
        </div>

        <div className="response-section">
          <div className="form-group">
            <label htmlFor="response-display">Response:</label>
            <div id="response-display" className="response-area">
              {responseType === "loading" && (
                <div className="loading">
                  <div className="spinner"></div>
                  <span>Evaluating content...</span>
                </div>
              )}
              {responseType === "success" && response && (
                <>
                  <div className="success">
                    <strong>Evaluation Complete!</strong>
                  </div>
                  <div className="response-content">{response}</div>
                </>
              )}
              {responseType === "error" && (
                <div className="error">
                  <strong>Error:</strong> {response}
                </div>
              )}
              {!responseType && (
                <p className="placeholder-text">Response will appear here...</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
