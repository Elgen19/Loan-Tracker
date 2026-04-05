const RESTRICTED_EMAIL = "mariefcabasa@gmail.com";
const RESTRICTED_CONTAINER_NAME = "faith";

export function isFaithOnlyUser(email) {
  return String(email || "").trim().toLowerCase() === RESTRICTED_EMAIL;
}

export function isAllowedContainerForUser(email, container) {
  if (!container) {
    return false;
  }

  if (!isFaithOnlyUser(email)) {
    return true;
  }

  return String(container.name || "").trim().toLowerCase() === RESTRICTED_CONTAINER_NAME;
}

export function filterContainersForUser(email, containers) {
  return containers.filter((container) => isAllowedContainerForUser(email, container));
}
