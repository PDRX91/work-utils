import { authenticateUser, createSession } from "../../../lib/auth.js";

export async function POST(request) {
  try {
    const { password } = await request.json();

    if (!password) {
      return Response.json({ error: "Password is required" }, { status: 400 });
    }

    const userId = await authenticateUser(password);
    const sessionId = await createSession(userId);

    return Response.json({
      success: true,
      sessionId,
      message: "Login successful",
    });
  } catch (error) {
    console.error("Login error:", error);
    return Response.json(
      {
        error: error.message,
      },
      { status: 401 }
    );
  }
}
