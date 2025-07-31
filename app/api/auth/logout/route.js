import { deleteSession } from "../../../lib/auth.js";

export async function POST(request) {
  try {
    const { sessionId } = await request.json();

    if (sessionId) {
      await deleteSession(sessionId);
    }

    return Response.json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    console.error("Logout error:", error);
    return Response.json(
      {
        error: "Logout failed",
      },
      { status: 500 }
    );
  }
}
