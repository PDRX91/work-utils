import { getDb } from "../../../lib/db.js";

export async function GET() {
  try {
    const db = await getDb();
    const user = await db.get("SELECT * FROM users LIMIT 1");

    return Response.json({
      needsInit: !user,
      message: user ? "User exists" : "No user found",
    });
  } catch (error) {
    console.error("Check init error:", error);
    return Response.json(
      {
        needsInit: true,
        error: "Failed to check initialization status",
      },
      { status: 500 }
    );
  }
}
