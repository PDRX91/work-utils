import { promises as fs } from "fs";
import path from "path";
import { requireAuth } from "../../lib/auth.js";

const SYSTEM_PROMPT_FILE = path.join(
  process.cwd(),
  "data",
  "mass-eval-sys-prompt.txt"
);

const getSystemPromptHandler = async () => {
  try {
    const content = await fs.readFile(SYSTEM_PROMPT_FILE, "utf8");
    console.log(
      "System prompt file read successfully, length:",
      content.length
    );
    return Response.json({ systemPrompt: content });
  } catch (error) {
    console.error("Error reading system prompt:", error);
    return Response.json(
      { error: "Failed to read system prompt" },
      { status: 500 }
    );
  }
};

const postSystemPromptHandler = async (request) => {
  try {
    const { systemPrompt } = await request.json();
    await fs.writeFile(SYSTEM_PROMPT_FILE, systemPrompt, "utf8");
    return Response.json({ success: true });
  } catch (error) {
    console.error("Error saving system prompt:", error);
    return Response.json(
      { error: "Failed to save system prompt" },
      { status: 500 }
    );
  }
};

export const GET = requireAuth(getSystemPromptHandler);
export const POST = requireAuth(postSystemPromptHandler);
