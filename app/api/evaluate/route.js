export async function POST(request) {
  try {
    const { model, systemPrompt, prompt } = await request.json();
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

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer":
            request.headers.get("origin") || "http://localhost:3000",
          "X-Title": "Mass Evaluation Tool",
        },
        body: JSON.stringify({
          model: model,
          messages: [
            ...(systemPrompt
              ? [
                  {
                    role: "system",
                    content: systemPrompt,
                  },
                ]
              : []),
            {
              role: "user",
              content: prompt,
            },
          ],
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

    // Create a TransformStream to handle the SSE data
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split("\n");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data === "[DONE]") {
                  controller.close();
                  return;
                }

                try {
                  const parsed = JSON.parse(data);
                  if (
                    parsed.choices &&
                    parsed.choices[0] &&
                    parsed.choices[0].delta &&
                    parsed.choices[0].delta.content
                  ) {
                    const content = parsed.choices[0].delta.content;
                    controller.enqueue(encoder.encode(content));
                  }
                } catch (e) {
                  // Skip invalid JSON lines
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("API Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
