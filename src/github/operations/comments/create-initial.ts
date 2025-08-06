#!/usr/bin/env bun

/**
 * Create the initial tracking comment when Claude Code starts working
 * This comment shows the working status and includes a link to the job run
 */

import { appendFileSync } from "fs";
import { createJobRunLink, createCommentBody, generateIdentifierString } from "./common";
import {
  isPullRequestReviewCommentEvent,
  isPullRequestEvent,
  type ParsedGitHubContext,
} from "../../context";
import type { Octokit } from "@octokit/rest";

const CLAUDE_APP_BOT_ID = 209825114;

export async function createInitialComment(
  octokit: Octokit,
  context: ParsedGitHubContext,
) {
  const { owner, repo } = context.repository;

  const jobRunLink = createJobRunLink(owner, repo, context.runId);
  const identifier = context.inputs.stickyCommentIdentifier;
  const initialBody = createCommentBody(jobRunLink, "", identifier);

  try {
    let response;

    if (
      context.inputs.useStickyComment &&
      context.isPR &&
      isPullRequestEvent(context)
    ) {
      const comments = await octokit.rest.issues.listComments({
        owner,
        repo,
        issue_number: context.entityNumber,
      });
      const existingComment = comments.data.find((comment) => {
        // Primary: Check for the specific identifier in the comment
        const identifierString = generateIdentifierString(identifier);
        if (comment.body?.includes(identifierString)) {
          return true;
        }
        
        // Fallback for backward compatibility with old comments that don't have identifiers
        // Only use this if we don't find a comment with an identifier
        const isFromClaudeBot = 
          comment.user?.id === CLAUDE_APP_BOT_ID ||
          (comment.user?.type === "Bot" && 
           comment.user?.login === "claude-code-github-action[bot]");
        
        // Check if this is an old-style comment without any identifier
        const hasNoIdentifier = !comment.body?.includes("<!-- claude-action-id:");
        
        // Match old comments from the Claude bot that don't have identifiers
        return isFromClaudeBot && hasNoIdentifier;
      });
      if (existingComment) {
        // Extract existing content (excluding the identifier line)
        let existingContent = existingComment.body || "";
        
        // Remove only the identifier line to get the actual content
        existingContent = existingContent.replace(/^<!-- claude-action-id:.*? -->\n?/, '');
        
        // Check if there's a "Previous run:" section and extract only the most recent run
        const previousRunMatch = existingContent.match(/^(\*\*Claude (?:finished|encountered).*?\*\*.*?)(?:\n\n---\n### Previous run:|$)/s);
        
        // Build new body: fresh working status + separator + only the most recent previous run
        const bodyWithHistory = previousRunMatch && previousRunMatch[1]?.trim()
          ? initialBody + "\n\n---\n### Previous run:\n" + previousRunMatch[1]
          : initialBody;
        
        response = await octokit.rest.issues.updateComment({
          owner,
          repo,
          comment_id: existingComment.id,
          body: bodyWithHistory,
        });
      } else {
        // Create new comment if no existing one found
        response = await octokit.rest.issues.createComment({
          owner,
          repo,
          issue_number: context.entityNumber,
          body: initialBody,
        });
      }
    } else if (isPullRequestReviewCommentEvent(context)) {
      // Only use createReplyForReviewComment if it's a PR review comment AND we have a comment_id
      response = await octokit.rest.pulls.createReplyForReviewComment({
        owner,
        repo,
        pull_number: context.entityNumber,
        comment_id: context.payload.comment.id,
        body: initialBody,
      });
    } else {
      // For all other cases (issues, issue comments, or missing comment_id)
      response = await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: context.entityNumber,
        body: initialBody,
      });
    }

    // Output the comment ID for downstream steps using GITHUB_OUTPUT
    const githubOutput = process.env.GITHUB_OUTPUT!;
    appendFileSync(githubOutput, `claude_comment_id=${response.data.id}\n`);
    console.log(`✅ Created initial comment with ID: ${response.data.id}`);
    return response.data;
  } catch (error) {
    console.error("Error in initial comment:", error);

    // Always fall back to regular issue comment if anything fails
    try {
      const response = await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: context.entityNumber,
        body: initialBody,
      });

      const githubOutput = process.env.GITHUB_OUTPUT!;
      appendFileSync(githubOutput, `claude_comment_id=${response.data.id}\n`);
      console.log(`✅ Created fallback comment with ID: ${response.data.id}`);
      return response.data;
    } catch (fallbackError) {
      console.error("Error creating fallback comment:", fallbackError);
      throw fallbackError;
    }
  }
}
