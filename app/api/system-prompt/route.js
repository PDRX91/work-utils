import { promises as fs } from "fs";
import path from "path";

const SYSTEM_PROMPT_FILE = path.join(
  process.cwd(),
  "data",
  "mass-eval-sys-prompt.txt"
);

export async function GET() {
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
}

export async function POST(request) {
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
}
