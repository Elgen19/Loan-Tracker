import { getFirestore } from "../config/firebase.js";

const COLLECTION_NAME = "auditLogs";

function getAuditCollection() {
  return getFirestore().collection(COLLECTION_NAME);
}

export async function writeAuditLog(entry) {
  const now = new Date().toISOString();

  await getAuditCollection().add({
    action: entry.action,
    workspaceId: entry.workspaceId || "",
    actorUid: entry.actorUid || "",
    actorEmail: entry.actorEmail || "",
    targetType: entry.targetType || "",
    targetId: entry.targetId || "",
    summary: entry.summary || "",
    metadata: entry.metadata || {},
    createdAt: now,
  });
}
