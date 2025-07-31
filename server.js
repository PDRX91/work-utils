import express from "express";
import path from "path";
import { promises as fs } from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());

// Serve static files from dist directory in production, or current directory in development
const staticDir = process.env.NODE_ENV === "production" ? "dist" : ".";
app.use(express.static(staticDir));
// Added: serve js and css directories in production
if (process.env.NODE_ENV === "production") {
  app.use("/js", express.static(path.join(__dirname, "js")));
  app.use("/css", express.static(path.join(__dirname, "css")));
}

// API endpoint to get system prompt
app.get("/api/system-prompt", async (req, res) => {
  try {
    const systemPromptPath = path.join(__dirname, "mass-eval-sys-prompt.txt");
    const content = await fs.readFile(systemPromptPath, "utf8");
    console.log(
      "System prompt file read successfully, length:",
      content.length
    );
    res.json({ systemPrompt: content });
  } catch (error) {
    console.error("Error reading system prompt:", error);
    res.status(500).json({ error: "Failed to read system prompt" });
  }
});

// API endpoint to save system prompt
app.post("/api/system-prompt", async (req, res) => {
  try {
    const { systemPrompt } = req.body;
    const systemPromptPath = path.join(__dirname, "mass-eval-sys-prompt.txt");
    await fs.writeFile(systemPromptPath, systemPrompt, "utf8");
    res.json({ success: true });
  } catch (error) {
    console.error("Error saving system prompt:", error);
    res.status(500).json({ error: "Failed to save system prompt" });
  }
});

// API endpoint for evaluation with streaming
app.post("/api/evaluate", async (req, res) => {
  try {
    const { model, systemPrompt, prompt } = req.body;
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return res
        .status(500)
        .json({ error: "OpenRouter API key not configured" });
    }

    if (!model || !prompt) {
      return res.status(400).json({ error: "Model and prompt are required" });
    }

    // Set up streaming response headers
    res.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": req.get("origin") || "http://localhost:3000",
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
          stream: true, // Enable streaming
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

    // Handle streaming response
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
              res.end();
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
                res.write(content);
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
  } catch (error) {
    console.error("API Error:", error);
    res.write(`Error: ${error.message}`);
    res.end();
  }
});

// Serve the main page
app.get("/", (req, res) => {
  const indexPath =
    process.env.NODE_ENV === "production"
      ? path.join(__dirname, "dist", "index.html")
      : path.join(__dirname, "index.html");
  res.sendFile(indexPath);
});

// Only start the server when running locally (not in Vercel serverless environment)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
