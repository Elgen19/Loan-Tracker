import { getAdminAuth } from "../config/firebase.js";

export async function requireAuth(req, res, next) {
  const authorizationHeader = req.headers.authorization || "";

  if (!authorizationHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication required." });
  }

  const idToken = authorizationHeader.slice("Bearer ".length).trim();

  try {
    const decodedToken = await getAdminAuth().verifyIdToken(idToken);
    const allowedEmails = (process.env.ALLOWED_USER_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);

    const normalizedEmail = String(decodedToken.email || "").trim().toLowerCase();

    if (allowedEmails.length > 0 && !allowedEmails.includes(normalizedEmail)) {
      return res.status(403).json({ message: "This account is not allowed to access the shared workspace." });
    }

    const requireEmailVerified = String(process.env.REQUIRE_EMAIL_VERIFIED || "false").toLowerCase() === "true";

    if (requireEmailVerified && !decodedToken.email_verified) {
      return res.status(403).json({ message: "Please verify this email address before accessing the shared workspace." });
    }

    req.user = decodedToken;
    req.workspaceId = process.env.SHARED_WORKSPACE_ID || "shared-loan-workspace";
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired session." });
  }
}
