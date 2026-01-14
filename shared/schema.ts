/**
 * Dev³ (Dev Cubed) - Multi-AI Decision System Schema
 * 
 * This module defines the data models and validation schemas for a consensus-based
 * decision-making system where three AI models (Grok, ChatGPT, Claude) collaborate
 * as a single developer entity.
 * 
 * @module schema
 */

import { z } from "zod";

/**
 * The three AI models that form the Dev³ trinity
 */
export const AI_MODELS = ["grok", "chatgpt", "claude"] as const;

/**
 * Type representing one of the three AI models
 */
export type AIModel = (typeof AI_MODELS)[number];

/**
 * Role definitions for each AI model in the Dev³ system
 * Each model has a specialized focus area for decision-making
 */
export const AI_MODEL_ROLES = {
  grok: {
    name: "Grok",
    role: "Risk & Momentum",
    description: "Risk assessment, momentum tracking, and edge detection",
  },
  chatgpt: {
    name: "ChatGPT",
    role: "Structure & Execution",
    description: "Structure, execution logic, and system design",
  },
  claude: {
    name: "Claude",
    role: "Ethics & Restraint",
    description: "Ethics, restraint, and long-term consistency",
  },
} as const;

/**
 * Valid states for a decision in the deliberation process
 * - pending: Initial state, awaiting AI responses
 * - deliberating: All AIs have responded, awaiting consensus calculation
 * - consensus_reached: Final decision has been made
 * - deadlock: Unable to reach consensus (reserved for future use)
 */
export const decisionStatusSchema = z.enum([
  "pending",
  "deliberating",
  "consensus_reached",
  "deadlock",
]);
export type DecisionStatus = z.infer<typeof decisionStatusSchema>;

/**
 * Schema for an AI model's response to a decision
 * Each response includes a vote, reasoning, and optional metadata
 */
export const aiResponseSchema = z.object({
  /** Unique identifier for this response */
  id: z.string(),
  /** ID of the decision this response belongs to */
  decisionId: z.string(),
  /** Which AI model provided this response */
  model: z.enum(AI_MODELS),
  /** The model's vote on the decision */
  vote: z.enum(["approve", "reject", "abstain"]),
  /** Detailed explanation for the vote */
  reasoning: z.string(),
  /** Confidence level from 0-100 */
  confidence: z.number().min(0).max(100),
  /** Identified risks (optional) */
  risks: z.array(z.string()).optional(),
  /** Suggested action items (optional) */
  recommendations: z.array(z.string()).optional(),
  /** ISO timestamp when response was created */
  createdAt: z.string(),
});
export type AIResponse = z.infer<typeof aiResponseSchema>;

/**
 * Schema for creating a new AI response (auto-generated fields omitted)
 */
export const insertAIResponseSchema = aiResponseSchema.omit({
  id: true,
  createdAt: true,
});
export type InsertAIResponse = z.infer<typeof insertAIResponseSchema>;

/**
 * Schema for the final consensus after all AI models have voted
 */
export const consensusSchema = z.object({
  /** Unique identifier for this consensus */
  id: z.string(),
  /** ID of the decision this consensus belongs to */
  decisionId: z.string(),
  /** Final outcome based on majority vote */
  outcome: z.enum(["approved", "rejected", "needs_revision"]),
  /** Whether all three models voted the same way */
  unanimity: z.boolean(),
  /** Breakdown of votes by type */
  voteSummary: z.object({
    approve: z.number(),
    reject: z.number(),
    abstain: z.number(),
  }),
  /** Combined reasoning from all AI models */
  synthesizedReasoning: z.string(),
  /** Merged action items from all recommendations */
  actionItems: z.array(z.string()).optional(),
  /** ISO timestamp when consensus was reached */
  createdAt: z.string(),
});
export type Consensus = z.infer<typeof consensusSchema>;

/**
 * Schema for a decision request to be deliberated by the AI trinity
 */
export const decisionSchema = z.object({
  /** Unique identifier for this decision */
  id: z.string(),
  /** Brief title describing the decision */
  title: z.string().min(1, "Title is required"),
  /** Detailed description of what needs to be decided */
  description: z.string().min(1, "Description is required"),
  /** Additional context or background information */
  context: z.string().optional(),
  /** Category of the decision for organization */
  category: z.enum([
    "architecture",
    "feature",
    "refactor",
    "security",
    "performance",
    "dependency",
    "other",
  ]),
  /** Urgency level of the decision */
  priority: z.enum(["low", "medium", "high", "critical"]),
  /** Current status in the deliberation workflow */
  status: decisionStatusSchema,
  /** Responses from each AI model */
  responses: z.array(aiResponseSchema).optional(),
  /** Final consensus (null if not yet reached) */
  consensus: consensusSchema.optional().nullable(),
  /** ISO timestamp when decision was created */
  createdAt: z.string(),
  /** ISO timestamp when decision was last updated */
  updatedAt: z.string(),
});
export type Decision = z.infer<typeof decisionSchema>;

/**
 * Schema for creating a new decision (auto-generated fields omitted)
 */
export const insertDecisionSchema = decisionSchema.omit({
  id: true,
  status: true,
  responses: true,
  consensus: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDecision = z.infer<typeof insertDecisionSchema>;

/**
 * Schema for updating an existing decision (all fields optional)
 */
export const updateDecisionSchema = insertDecisionSchema.partial();
export type UpdateDecision = z.infer<typeof updateDecisionSchema>;

/**
 * Activity log event types - system-generated actions only
 * No human entries. No retroactive edits.
 */
export const ACTIVITY_TYPES = [
  "decision_created",
  "deliberation_started",
  "deliberation_completed",
  "consensus_approved",
  "consensus_rejected",
  "consensus_needs_revision",
  "decision_deleted",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/**
 * Schema for system-generated activity log entries
 * These are facts, not opinions - describing executed outcomes only
 */
export const activityLogSchema = z.object({
  id: z.string(),
  type: z.enum(ACTIVITY_TYPES),
  decisionId: z.string().optional(),
  decisionTitle: z.string().optional(),
  outcome: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  timestamp: z.string(),
});
export type ActivityLog = z.infer<typeof activityLogSchema>;

// Legacy user types (kept for compatibility)
export const users = undefined;
export type User = { id: string; username: string; password: string };
export type InsertUser = { username: string; password: string };
