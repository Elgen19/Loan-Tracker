import { claimLegacyContainers } from "../data/containerRepository.js";
import { claimLegacyLoans } from "../data/loanRepository.js";

export async function postClaimLegacyData(req, res, next) {
  try {
    const userId = req.user.uid;
    const workspaceId = req.workspaceId;
    const [claimedContainers, claimedLoans] = await Promise.all([
      claimLegacyContainers(workspaceId, userId),
      claimLegacyLoans(workspaceId, userId),
    ]);

    return res.json({
      claimedContainers: claimedContainers.length,
      claimedLoans: claimedLoans.length,
    });
  } catch (error) {
    return next(error);
  }
}
