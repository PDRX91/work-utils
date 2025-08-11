import { promises as fs } from "fs";
import path from "path";

const SYSTEM_PROMPT_FILE = path.join(
  process.cwd(),
  "data",
  "agent-completion-grader-sys-prompt.txt"
);
const RULES_FILE = path.join(
  process.cwd(),
  "data",
  "agent-completion-grader-rules.json"
);

export async function GET() {
  try {
    const [promptContent, rulesContent] = await Promise.all([
      fs.readFile(SYSTEM_PROMPT_FILE, "utf8").catch(() => ""),
      fs.readFile(RULES_FILE, "utf8").catch(() => "[]"),
    ]);

    return Response.json({
      systemPrompt: promptContent,
      rulesList: JSON.parse(rulesContent || "[]"),
    });
  } catch (error) {
    console.error("Error reading system prompt or rules:", error);
    return Response.json(
      { error: "Failed to read system prompt or rules" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const { systemPrompt, rulesList } = await request.json();

    if (systemPrompt !== undefined) {
      await fs.writeFile(SYSTEM_PROMPT_FILE, systemPrompt, "utf8");
    }
    if (rulesList !== undefined) {
      await fs.writeFile(
        RULES_FILE,
        JSON.stringify(rulesList, null, 2),
        "utf8"
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error saving system prompt or rules:", error);
    return Response.json(
      { error: "Failed to save system prompt or rules" },
      { status: 500 }
    );
  }
}
