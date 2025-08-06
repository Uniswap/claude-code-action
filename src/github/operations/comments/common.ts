import { GITHUB_SERVER_URL } from "../../api/config";

export const SPINNER_HTML =
  '<img src="https://github.com/user-attachments/assets/5ac382c7-e004-429b-8e35-7feb3e8f9c6f" width="14px" height="14px" style="vertical-align: middle; margin-left: 4px;" />';

/**
 * Generate the hidden identifier string for comments
 */
export function generateIdentifierString(identifier: string = "default"): string {
  return `<!-- claude-action-id:${identifier} -->`;
}

/**
 * Extract the identifier from a comment body
 * Returns the identifier value (not the full HTML comment) or null if not found
 */
export function extractIdentifier(body: string): string | null {
  const match = body.match(/<!-- claude-action-id:(.*?) -->/);
  return match && match[1] ? match[1] : null;
}

export function createJobRunLink(
  owner: string,
  repo: string,
  runId: string,
): string {
  const jobRunUrl = `${GITHUB_SERVER_URL}/${owner}/${repo}/actions/runs/${runId}`;
  return `[View job run](${jobRunUrl})`;
}

export function createBranchLink(
  owner: string,
  repo: string,
  branchName: string,
): string {
  const branchUrl = `${GITHUB_SERVER_URL}/${owner}/${repo}/tree/${branchName}`;
  return `\n[View branch](${branchUrl})`;
}

export function createCommentBody(
  jobRunLink: string,
  branchLink: string = "",
  identifier: string = "default",
): string {
  // Always include an identifier for consistent comment tracking
  const hiddenIdentifier = generateIdentifierString(identifier) + "\n";
  return `${hiddenIdentifier}Claude Code is working… ${SPINNER_HTML}

I'll analyze this and get back to you.

${jobRunLink}${branchLink}`;
}
