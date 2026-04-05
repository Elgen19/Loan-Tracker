import { writeAuditLog } from "../data/auditRepository.js";

export async function logAuditEvent(req, details) {
  try {
    await writeAuditLog({
      workspaceId: req.workspaceId,
      actorUid: req.user?.uid || "",
      actorEmail: req.user?.email || "",
      ...details,
    });
  } catch (error) {
    console.error("Audit log write failed:", error.message);
  }
}
