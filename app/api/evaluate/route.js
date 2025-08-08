export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { model, systemPrompt, rulesList, prompt, toolSchemaSubset } =
      await request.json();
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return Response.json(
        { error: "OpenRouter API key not configured" },
        { status: 500 }
      );
    }

    if (!model || !prompt) {
      return Response.json(
        { error: "Model and prompt are required" },
        { status: 400 }
      );
    }

    // Build the final system prompt
    let finalSystemPrompt = systemPrompt?.trim() || "";

    // Append rules list if provided
    if (rulesList && Array.isArray(rulesList) && rulesList.length > 0) {
      finalSystemPrompt += `

---
RULES CHECKLIST:
${JSON.stringify(rulesList, null, 2)}
`;
    }

    // Append tool schema subset if provided
    if (toolSchemaSubset && Object.keys(toolSchemaSubset).length > 0) {
      finalSystemPrompt += `

---
TOOL SCHEMA SUBSET (only tools used in this conversation):
${JSON.stringify(toolSchemaSubset, null, 2)}
`;
    }

    // Log inbound payload summary (no secrets)
    try {
      console.debug("[evaluate] inbound payload", {
        model,
        systemPromptLength: finalSystemPrompt.length,
        rulesCount: Array.isArray(rulesList) ? rulesList.length : 0,
        promptLength: typeof prompt === "string" ? prompt.length : 0,
        toolSchemaSubsetKeys: toolSchemaSubset
          ? Object.keys(toolSchemaSubset).length
          : 0,
      });
    } catch {}

    // Prepare messages and log exact payload sent upstream (excluding API key)
    const messages = [
      ...(finalSystemPrompt
        ? [
            {
              role: "system",
              content: finalSystemPrompt,
            },
          ]
        : []),
      {
        role: "user",
        content: prompt,
      },
    ];

    try {
      console.debug("[evaluate] outbound openrouter payload", {
        model,
        temperature: 0.7,
        max_tokens: 4000,
        stream: true,
        messagesPreview: messages.map((m) => ({
          role: m.role,
          contentPreview:
            typeof m.content === "string"
              ? m.content.slice(0, 240)
              : JSON.stringify(m.content).slice(0, 240),
          contentLength:
            typeof m.content === "string"
              ? m.content.length
              : JSON.stringify(m.content).length,
        })),
      });
    } catch {}

    // Send request to OpenRouter (SSE streaming)
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          "HTTP-Referer":
            request.headers.get("origin") || "http://localhost:3000",
          "X-Title": "Mass Evaluation Tool",
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7,
          max_tokens: 4000,
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message ||
          `HTTP ${response.status}: ${response.statusText}`
      );
    }

    try {
      const upstreamHeaders = {};
      response.headers.forEach((v, k) => (upstreamHeaders[k] = v));
      console.debug("[evaluate] upstream response ok", {
        status: response.status,
        headers: upstreamHeaders,
      });
    } catch {}

    // If client prefers SSE, passthrough upstream SSE directly for maximum compatibility
    const encoder = new TextEncoder();
    const preferSse = request.headers.get("x-client-stream") === "sse";
    if (preferSse) {
      try {
        console.debug("[evaluate] returning upstream SSE passthrough");
      } catch {}
      return new Response(response.body, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    // Otherwise, parse and emit plain text stream
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = ""; // carry incomplete lines between chunks
        let totalBytes = 0;

        try {
          // Send an initial comment/heartbeat to kick off streaming in some proxies
          try {
            if (preferSse) {
              controller.enqueue(encoder.encode(": start\n\n"));
            } else {
              controller.enqueue(encoder.encode("\n"));
            }
          } catch {}

          // Fast-path: if client prefers SSE, proxy upstream SSE bytes directly.
          if (preferSse) {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              totalBytes += value?.byteLength || 0;
              try {
                console.debug("[evaluate] passthrough chunk", {
                  bytes: value?.byteLength || 0,
                  totalBytes,
                });
              } catch {}
              controller.enqueue(value);
            }
            return;
          }

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Decode streaming and accumulate
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
            totalBytes += value?.byteLength || 0;

            try {
              console.debug("[evaluate] received chunk", {
                bytes: value?.byteLength || 0,
                totalBytes,
                preview: chunk.slice(0, 120),
              });
            } catch {}

            // Process complete lines; keep last partial in buffer
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop() || "";

            for (const rawLine of lines) {
              const line = rawLine.trim();
              if (!line) continue;
              if (!line.startsWith("data:")) continue; // ignore comments/other fields

              const data = line.slice(5).trim(); // after 'data:'
              if (!data) continue;
              if (data === "[DONE]") {
                try {
                  console.debug("[evaluate] upstream done token received");
                } catch {}
                controller.close();
                return;
              }

              try {
                const parsed = JSON.parse(data);

                // OpenAI-style streaming deltas
                const choice = parsed.choices && parsed.choices[0];
                if (choice) {
                  const delta = choice.delta || {};
                  const message = choice.message || {};

                  let textOut = "";

                  // Common providers: string content
                  if (typeof delta.content === "string") {
                    textOut = delta.content;
                  } else if (typeof message.content === "string") {
                    textOut = message.content;
                  } else if (typeof delta.text === "string") {
                    textOut = delta.text;
                  }

                  // Gemini via OpenRouter may send content as array of blocks
                  const pullArrayContent = (contentVal) => {
                    if (!Array.isArray(contentVal)) return "";
                    return contentVal
                      .map((part) => {
                        if (!part) return "";
                        if (typeof part === "string") return part;
                        if (typeof part.text === "string") return part.text;
                        if (
                          typeof part.type === "string" &&
                          (part.type === "text" ||
                            part.type === "output_text") &&
                          typeof part.text === "string"
                        ) {
                          return part.text;
                        }
                        return "";
                      })
                      .join("");
                  };

                  if (!textOut || textOut.length === 0) {
                    textOut =
                      pullArrayContent(delta.content) ||
                      pullArrayContent(message.content);
                  }

                  if (textOut && textOut.length) {
                    if (preferSse) {
                      controller.enqueue(
                        encoder.encode(`data: ${textOut}\n\n`)
                      );
                    } else {
                      controller.enqueue(encoder.encode(textOut));
                      controller.enqueue(encoder.encode("\n"));
                    }
                    try {
                      console.debug("[evaluate] emitted content piece", {
                        length: textOut.length,
                        preview: textOut.slice(0, 120),
                      });
                    } catch {}
                  }
                }
              } catch {
                // Ignore malformed/partial JSON lines
              }
            }
          }
        } finally {
          reader.releaseLock();
          // Flush any trailing buffer if it contained a final complete JSON line without newline
          const trailing = buffer.trim();
          if (trailing.startsWith("data:")) {
            const data = trailing.slice(5).trim();
            try {
              const parsed = JSON.parse(data);
              const choice = parsed.choices && parsed.choices[0];
              if (choice) {
                const delta = choice.delta || {};
                const message = choice.message || {};
                let textOut = "";
                if (typeof delta.content === "string") textOut = delta.content;
                else if (typeof message.content === "string")
                  textOut = message.content;
                else if (typeof delta.text === "string") textOut = delta.text;
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
                if (!textOut || textOut.length === 0) {
                  textOut =
                    pullArrayContent(delta.content) ||
                    pullArrayContent(message.content);
                }
                if (textOut && textOut.length) {
                  if (preferSse) {
                    controller.enqueue(encoder.encode(`data: ${textOut}\n\n`));
                  } else {
                    controller.enqueue(encoder.encode(textOut));
                    controller.enqueue(encoder.encode("\n"));
                  }
                  try {
                    console.debug("[evaluate] emitted trailing content piece", {
                      length: textOut.length,
                      preview: textOut.slice(0, 120),
                    });
                  } catch {}
                }
              }
            } catch {
              // ignore
            }
          }
          // Finish the SSE stream if in SSE mode
          if (preferSse) {
            try {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            } catch {}
          }
        }
      },
    });

    return new Response(stream, {
      headers: preferSse
        ? {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
          }
        : {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store, no-transform",
            "Content-Encoding": "identity",
            "X-Accel-Buffering": "no",
          },
    });
  } catch (error) {
    console.error("API Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
