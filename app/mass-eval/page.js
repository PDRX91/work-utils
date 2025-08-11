"use client";

import { useState, useEffect } from "react";
import toolSchema from "@/data/agent-completion-grader-tool-schema.json"; // full schema

export default function MassEval() {
  const [model, setModel] = useState(
    localStorage.getItem("mass-eval-model") ?? "google/gemini-2.5-pro"
  );
  const [systemPrompt, setSystemPrompt] = useState("");
  const [savedSystemPrompt, setSavedSystemPrompt] = useState("");
  const [rulesList, setRulesList] = useState([]);
  const [savedRulesList, setSavedRulesList] = useState([]);
  const [prompt, setPrompt] = useState(
    "Please grade the following content based on the rules described in the system prompt."
  );
  const [content, setContent] = useState("");
  const [response, setResponse] = useState("");
  const [maxTokens, setMaxTokens] = useState(50000);
  const [isLoading, setIsLoading] = useState(false);
  const [responseType, setResponseType] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [reasoningDone, setReasoningDone] = useState(false);
  const [responseDone, setResponseDone] = useState(false);
  const [hadError, setHadError] = useState(false);

  // Streaming debug controls
  const [debugStreaming, setDebugStreaming] = useState(false);
  const [slowDelayMs, setSlowDelayMs] = useState(0);
  const [streamLogs, setStreamLogs] = useState([]);
  const [showReasoning, setShowReasoning] = useState(true);
  const [rawSseLines, setRawSseLines] = useState([]);

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text || "");
    } catch (err) {
      console.error("clipboard copy failed", err);
    }
  };

  // Collapsible section states
  const [isSystemPromptCollapsed, setIsSystemPromptCollapsed] = useState(false);
  const [isRulesListCollapsed, setIsRulesListCollapsed] = useState(false);
  const [isPromptCollapsed, setIsPromptCollapsed] = useState(false);
  const [isContentCollapsed, setIsContentCollapsed] = useState(false);
  const [isReasoningCollapsed, setIsReasoningCollapsed] = useState(false);
  const [isResponseCollapsed, setIsResponseCollapsed] = useState(false);
  const [isDebugCollapsed, setIsDebugCollapsed] = useState(true);

  // Load stored data on mount
  useEffect(() => {
    const storedModel = localStorage.getItem("mass-eval-model");
    const storedPrompt = localStorage.getItem("mass-eval-prompt");
    const storedContent = localStorage.getItem("mass-eval-content");

    if (storedModel) setModel(storedModel);
    if (storedPrompt) setPrompt(storedPrompt);
    if (storedContent) setContent(storedContent);

    document.getElementById("model-select").value = model;

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
    // Reset all UI + buffers
    setStreamLogs([]);
    setRawSseLines([]);
    setResponse("");
    setReasoning("");
    setReasoningDone(false);
    setResponseDone(false);
    setHadError(false);

    try {
      const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Always request SSE so reasoning/content JSON deltas stream regardless of debug UI
          "x-client-stream": "sse",
        },
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
          maxTokens,
        }),
      });

      // Log the exact outbound payload from the client
      try {
        // eslint-disable-next-line no-console
        // console.debug("[mass-eval] outbound payload", {
        //   model,
        //   systemPromptLength: systemPrompt.trim().length,
        //   rulesCount: rulesList.length,
        //   promptLength: `${prompt}\n\nContent to evaluate:\n${JSON.stringify(
        //     conversation,
        //     null,
        //     2
        //   )}`.length,
        //   toolSchemaSubsetKeys: Object.keys(subsetSchema || {}).length,
        //   promptPreview: `${prompt}\n\nContent to evaluate:\n${JSON.stringify(
        //     conversation,
        //     null,
        //     2
        //   )}`.slice(0, 240),
        // });
      } catch {}

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `HTTP ${response.status}: ${response.statusText}`
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Readable stream not available on response.body");
      }
      const isSse = response.headers
        .get("content-type")
        ?.includes("text/event-stream");
      const decoder = new TextDecoder();
      let fullResponse = "";
      const startAtMs = performance.now();

      setResponseType("success");

      if (debugStreaming) {
        const headersObj = {};
        response.headers.forEach((v, k) => {
          headersObj[k] = v;
        });
        setStreamLogs((prev) => [
          ...prev,
          { type: "headers", t: 0, headers: headersObj },
        ]);
      }

      let carry = "";
      let contentBuffer = "";
      let reasoningBuffer = "";
      let lastReasoningFragment = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });

        if (isSse) {
          carry += text;
          const lines = carry.split(/\r?\n/);
          carry = lines.pop() || "";
          for (const raw of lines) {
            if (!raw) continue;
            if (raw.startsWith(":")) continue; // SSE comment
            if (!raw.startsWith("data:")) continue;
            const data = raw.slice(5).trim();
            if (!data) continue;
            if (data === "[DONE]") {
              // will break on next loop when reader is done
              continue;
            }
            // Keep optional raw capture for debugging
            if (debugStreaming) {
              setRawSseLines((prev) => [...prev, data]);
            }

            // Try to parse JSON event; fallback to raw
            let parsed;
            try {
              parsed = JSON.parse(data);
            } catch {
              fullResponse += data + "\n";
              continue;
            }

            const choice = parsed?.choices?.[0] || {};
            const delta = choice.delta || {};
            const message = choice.message || {};

            const pullArrayContent = (contentVal) => {
              if (!Array.isArray(contentVal)) return "";
              return contentVal
                .map((part) => {
                  if (!part) return "";
                  if (typeof part === "string") return part;
                  if (typeof part.text === "string") return part.text;
                  if (
                    typeof part.type === "string" &&
                    (part.type === "text" || part.type === "output_text") &&
                    typeof part.text === "string"
                  ) {
                    return part.text;
                  }
                  return "";
                })
                .join("");
            };

            // Aggregate optional reasoning stream without duplication
            let reasoningChunk = "";
            if (
              Array.isArray(delta.reasoning_details) &&
              delta.reasoning_details.length
            ) {
              reasoningChunk = delta.reasoning_details
                .map((rd) => (typeof rd?.text === "string" ? rd.text : ""))
                .join("");
            } else if (
              typeof delta.reasoning === "string" &&
              delta.reasoning.length
            ) {
              reasoningChunk = delta.reasoning;
            }
            if (reasoningChunk && reasoningChunk !== lastReasoningFragment) {
              reasoningBuffer += reasoningChunk;
              lastReasoningFragment = reasoningChunk;
            }

            // Aggregate content
            let contentPiece = "";
            if (typeof delta.content === "string") contentPiece = delta.content;
            else if (typeof message.content === "string")
              contentPiece = message.content;
            else if (typeof delta.text === "string") contentPiece = delta.text;
            if (!contentPiece) {
              contentPiece =
                pullArrayContent(delta.content) ||
                pullArrayContent(message.content);
            }
            if (contentPiece) {
              contentBuffer += contentPiece;
            }

            // Render joined result
            fullResponse = contentBuffer;
            setReasoning(reasoningBuffer);
          }
        } else {
          fullResponse += text;
        }

        if (debugStreaming) {
          const t = Math.round(performance.now() - startAtMs);
          const bytes = value?.byteLength ?? 0;
          const preview = text.slice(0, 120);
          // eslint-disable-next-line no-console
          console.debug("[stream] chunk", { tMs: t, bytes, preview });
          setStreamLogs((prev) => [
            ...prev,
            { type: "chunk", t, bytes, preview },
          ]);
          if (slowDelayMs && slowDelayMs > 0) {
            // eslint-disable-next-line no-await-in-loop
            await new Promise((r) => setTimeout(r, slowDelayMs));
          }
        }

        setResponse(fullResponse);

        // Auto-scroll the reasoning and response panels to bottom as we stream
        try {
          const areas = document.querySelectorAll(
            ".collapsible-section .section-content .response-area"
          );
          areas.forEach((el) => {
            el.scrollTop = el.scrollHeight;
          });
        } catch {}
      }

      if (debugStreaming) {
        const t = Math.round(performance.now() - startAtMs);
        setStreamLogs((prev) => [...prev, { type: "done", t }]);
      }

      // Mark streams complete (unless we threw earlier)
      setReasoningDone((prev) => prev || true);
      setResponseDone((prev) => prev || true);
    } catch (error) {
      console.error("Evaluation error:", error);
      showError(`Error: ${error.message}`);
      setHadError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const hasChanges =
    systemPrompt !== savedSystemPrompt ||
    JSON.stringify(rulesList) !== JSON.stringify(savedRulesList);

  // TODO: Make all buttons disabled in logical states like empty/unchanged text areas
  return (
    <div className="container mass-eval">
      <h1>Mass Evaluation Tool (Grader Version)</h1>

      <div className="eval-container">
        {/* Top row controls */}
        <div className="config-section">
          <div className="eval-columns">
            <div className="form-group" style={{ flex: 1 }}>
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
                <option value="anthropic/claude-sonnet-4">
                  Claude Sonnet 4
                </option>
                <option value="anthropic/claude-opus-4.1">
                  Claude Opus 4.1 (VERY EXPENSIVE)
                </option>
                <option value="google/gemini-2.5-flash">
                  Gemini 2.5 Flash
                </option>
                <option value="google/gemini-2.5-pro">Gemini 2.5 Pro</option>
                <option value="deepseek/deepseek-r1-0528:free">
                  Deepseek R1
                </option>
              </select>
            </div>
            <div className="form-group" style={{ width: 250 }}>
              <label htmlFor="max-tokens">Max response tokens:</label>
              <input
                id="max-tokens"
                type="number"
                min={256}
                step={256}
                value={maxTokens}
                onChange={(e) =>
                  setMaxTokens(parseInt(e.target.value || "0", 10) || 0)
                }
                className="small-number-input"
              />
            </div>
          </div>
        </div>

        <div className="eval-columns">
          <div className="eval-left">
            <div className="collapsible-section">
              <div
                className="section-header"
                onClick={() =>
                  setIsSystemPromptCollapsed(!isSystemPromptCollapsed)
                }
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
                    {/* TODO: Make editable and add a button to save changes */}
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
                    {/* TODO: Add a button to save/clear changes */}
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
          </div>

          <div className="eval-right">
            {/* Reasoning Panel */}
            <div className="collapsible-section">
              <div
                className="section-header"
                onClick={() => setIsReasoningCollapsed(!isReasoningCollapsed)}
              >
                <h3>
                  Reasoning (streamed)
                  <span
                    className={`collapse-indicator ${
                      isReasoningCollapsed ? "collapsed" : ""
                    }`}
                  >
                    ▼
                  </span>
                </h3>
              </div>
              {!isReasoningCollapsed && (
                <div className="section-content">
                  <div
                    className={`response-area ${
                      hadError
                        ? "border-error"
                        : reasoningDone
                        ? "border-success"
                        : ""
                    }`}
                  >
                    {reasoning ? (
                      <div>{reasoning}</div>
                    ) : (
                      <div className="placeholder-text">No reasoning yet.</div>
                    )}
                  </div>
                  <div className="mt-8">
                    <button
                      className="button primary copy-button"
                      type="button"
                      onClick={() => copyToClipboard(reasoning)}
                    >
                      Copy reasoning
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Response Panel */}
            <div className="collapsible-section">
              <div
                className="section-header"
                onClick={() => setIsResponseCollapsed(!isResponseCollapsed)}
              >
                <h3>
                  Response
                  <span
                    className={`collapse-indicator ${
                      isResponseCollapsed ? "collapsed" : ""
                    }`}
                  >
                    ▼
                  </span>
                </h3>
              </div>
              {!isResponseCollapsed && (
                <div className="section-content">
                  <div
                    className={`response-area ${
                      hadError
                        ? "border-error"
                        : responseDone
                        ? "border-success"
                        : ""
                    }`}
                  >
                    {responseType === "loading" && (
                      <div>Evaluating content...</div>
                    )}
                    {responseType === "success" && <div>{response}</div>}
                    {responseType === "error" && (
                      <div className="error">{response}</div>
                    )}
                  </div>
                  <div className="mt-8">
                    <button
                      className="button primary copy-button"
                      type="button"
                      onClick={() => copyToClipboard(response)}
                    >
                      Copy response
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Streaming Debug Panel */}
            <div className="collapsible-section">
              <div
                className="section-header"
                onClick={() => setIsDebugCollapsed(!isDebugCollapsed)}
              >
                <h3>
                  Streaming debug
                  <span
                    className={`collapse-indicator ${
                      isDebugCollapsed ? "collapsed" : ""
                    }`}
                  >
                    ▼
                  </span>
                </h3>
              </div>
              {!isDebugCollapsed && (
                <div className="section-content">
                  <div className="stream-panel">
                    <label className="inline-checkbox-label">
                      <input
                        type="checkbox"
                        checked={debugStreaming}
                        onChange={(e) => setDebugStreaming(e.target.checked)}
                      />
                      Enable streaming debug
                    </label>
                    <label>
                      Per-chunk delay (ms):
                      <input
                        type="number"
                        min="0"
                        step="10"
                        value={slowDelayMs}
                        onChange={(e) =>
                          setSlowDelayMs(parseInt(e.target.value || "0", 10))
                        }
                        className="small-number-input"
                      />
                    </label>

                    <div className="stream-logs">
                      {streamLogs.length === 0 && (
                        <div>No streaming logs yet.</div>
                      )}
                      {streamLogs.map((log, idx) => (
                        <div key={idx}>
                          {log.type === "headers" && (
                            <div>
                              <strong>[0ms] headers</strong>{" "}
                              {JSON.stringify(log.headers)}
                            </div>
                          )}
                          {log.type === "chunk" && (
                            <div>
                              <strong>[{log.t}ms] chunk</strong> bytes=
                              {log.bytes} preview="{log.preview}"
                            </div>
                          )}
                          {log.type === "done" && (
                            <div>
                              <strong>[{log.t}ms] done</strong>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="stream-raw">
                      <label>Raw stream (data: lines)</label>
                      <textarea
                        readOnly
                        rows={8}
                        value={(rawSseLines && rawSseLines.length
                          ? rawSseLines.join("\n")
                          : ""
                        ).toString()}
                        className="stream-textarea"
                      />
                      <div className="mt-8">
                        <button
                          className="button primary copy-button"
                          type="button"
                          onClick={() =>
                            copyToClipboard((rawSseLines || []).join("\n"))
                          }
                        >
                          Copy debug stream
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
