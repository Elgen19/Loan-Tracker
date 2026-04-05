import { getFirestore } from "../config/firebase.js";

const COLLECTION_NAME = "loanContainers";

function serializeContainer(doc) {
  return {
    id: doc.id,
    ...doc.data(),
  };
}

function getContainerCollection() {
  return getFirestore().collection(COLLECTION_NAME);
}

export async function listContainers(userId) {
  const snapshot = await getContainerCollection().get();

  return snapshot.docs
    .map(serializeContainer)
    .filter((container) => container.workspaceId === userId)
    .sort((left, right) => new Date(left.createdAt || 0).getTime() - new Date(right.createdAt || 0).getTime());
}

export async function createContainer(input, userId) {
  const now = new Date().toISOString();
  const payload = {
    name: input.name,
    description: input.description || "",
    workspaceId: userId,
    createdBy: input.createdBy || "",
    createdAt: now,
    updatedAt: now,
  };

  const docRef = await getContainerCollection().add(payload);
  const createdDoc = await docRef.get();
  return serializeContainer(createdDoc);
}

export async function getContainerByName(userId, name) {
  const snapshot = await getContainerCollection().get();
  const normalizedName = String(name || "").trim();

  return (
    snapshot.docs
      .map(serializeContainer)
      .find((container) => container.workspaceId === userId && container.name === normalizedName) || null
  );
}

export async function getContainerById(userId, containerId) {
  const doc = await getContainerCollection().doc(containerId).get();

  if (!doc.exists) {
    return null;
  }

  const container = serializeContainer(doc);
  return container.workspaceId === userId ? container : null;
}

export async function claimLegacyContainers(workspaceId, userId) {
  const snapshot = await getContainerCollection().get();
  const claimedContainers = [];

  for (const doc of snapshot.docs) {
    const container = serializeContainer(doc);

    if (container.workspaceId) {
      continue;
    }

    const updatedAt = new Date().toISOString();
    await doc.ref.update({
      workspaceId,
      createdBy: container.createdBy || container.userId || userId,
      updatedAt,
    });

    claimedContainers.push({
      id: container.id,
      name: container.name,
    });
  }

  return claimedContainers;
}
