import { initializeUser } from "../../../lib/auth.js";

export async function POST(request) {
  try {
    const { password } = await request.json();

    if (!password) {
      return Response.json({ error: "Password is required" }, { status: 400 });
    }

    if (password.length < 8) {
      return Response.json(
        { error: "Password must be at least 8 characters long" },
        { status: 400 }
      );
    }

    const userId = await initializeUser(password);

    return Response.json({
      success: true,
      message: "User initialized successfully",
    });
  } catch (error) {
    console.error("Init error:", error);
    return Response.json(
      {
        error: error.message,
      },
      { status: 400 }
    );
  }
}
