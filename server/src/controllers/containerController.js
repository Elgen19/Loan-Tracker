import { createContainer, getContainerByName, listContainers } from "../data/containerRepository.js";
import { assignLoansToContainer } from "../data/loanRepository.js";
import { logAuditEvent } from "../utils/audit.js";
import { filterContainersForUser, isFaithOnlyUser } from "../utils/accessPolicy.js";

function validateContainerPayload(body) {
  if (!body.name) {
    return "Missing required field: name";
  }

  return null;
}

export async function getContainers(req, res, next) {
  try {
    const containers = filterContainersForUser(req.user.email, await listContainers(req.workspaceId));
    return res.json({ containers });
  } catch (error) {
    return next(error);
  }
}

export async function postContainer(req, res, next) {
  const validationError = validateContainerPayload(req.body);

  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  try {
    if (isFaithOnlyUser(req.user.email)) {
      return res.status(403).json({ message: "This account can only access the Faith container." });
    }

    const container = await createContainer({ ...req.body, createdBy: req.user.uid }, req.workspaceId);
    await logAuditEvent(req, {
      action: "container.create",
      targetType: "container",
      targetId: container.id,
      summary: `Created container ${container.name}`,
      metadata: {
        containerName: container.name,
      },
    });
    return res.status(201).json(container);
  } catch (error) {
    return next(error);
  }
}

export async function postAssignExistingLoans(req, res, next) {
  try {
    if (isFaithOnlyUser(req.user.email)) {
      return res.status(403).json({ message: "This account can only access the Faith container." });
    }

    const containerName = req.body?.containerName;
    const container = containerName ? await getContainerByName(req.workspaceId, containerName) : null;

    if (!container) {
      return res.status(404).json({ message: "Container not found." });
    }

    const updatedLoans = await assignLoansToContainer(req.workspaceId, container.id);

    await logAuditEvent(req, {
      action: "loan.assign-existing",
      targetType: "container",
      targetId: container.id,
      summary: `Assigned ${updatedLoans.length} existing loan(s) to ${container.name}`,
      metadata: {
        containerName: container.name,
        updatedCount: updatedLoans.length,
      },
    });

    return res.json({
      container,
      updatedCount: updatedLoans.length,
      updatedLoans,
    });
  } catch (error) {
    return next(error);
  }
}
