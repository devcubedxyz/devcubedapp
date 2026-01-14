/**
 * Dev³ Storage Layer
 * 
 * Provides an abstracted storage interface for the Dev³ decision-making system.
 * Currently implements in-memory storage, but the interface allows for easy
 * swapping to persistent storage solutions like PostgreSQL.
 * 
 * @module storage
 */

import {
  type Decision,
  type InsertDecision,
  type UpdateDecision,
  type AIResponse,
  type InsertAIResponse,
  type Consensus,
  type ActivityLog,
  type ActivityType,
  AI_MODELS,
} from "@shared/schema";
import { randomUUID } from "crypto";

/**
 * Storage interface defining all CRUD operations for the Dev³ system.
 * Implementations must provide these methods for decision management.
 */
export interface IStorage {
  /**
   * Creates a new decision request
   * @param decision - The decision data to create
   * @returns The created decision with generated ID and timestamps
   */
  createDecision(decision: InsertDecision): Promise<Decision>;

  /**
   * Retrieves a single decision by ID, including responses and consensus
   * @param id - The decision ID
   * @returns The decision if found, undefined otherwise
   */
  getDecision(id: string): Promise<Decision | undefined>;

  /**
   * Retrieves all decisions, sorted by creation date (newest first)
   * @returns Array of all decisions with their responses and consensus
   */
  getAllDecisions(): Promise<Decision[]>;

  /**
   * Updates an existing decision
   * @param id - The decision ID to update
   * @param updates - Partial decision data to apply
   * @returns The updated decision if found, undefined otherwise
   */
  updateDecision(id: string, updates: UpdateDecision): Promise<Decision | undefined>;

  /**
   * Deletes a decision and all associated responses and consensus
   * @param id - The decision ID to delete
   * @returns True if the decision existed and was deleted
   */
  deleteDecision(id: string): Promise<boolean>;

  /**
   * Adds an AI model's response to a decision
   * Replaces existing response from the same model if present
   * @param response - The AI response to add
   * @returns The created response with generated ID and timestamp
   */
  addAIResponse(response: InsertAIResponse): Promise<AIResponse>;

  /**
   * Gets all AI responses for a decision
   * @param decisionId - The decision ID
   * @returns Array of AI responses
   */
  getAIResponses(decisionId: string): Promise<AIResponse[]>;

  /**
   * Sets the consensus for a decision
   * @param decisionId - The decision ID
   * @param consensus - The consensus data (without ID, decisionId, createdAt)
   * @returns The created consensus if decision exists, undefined otherwise
   */
  setConsensus(
    decisionId: string, 
    consensus: Omit<Consensus, "id" | "decisionId" | "createdAt">
  ): Promise<Consensus | undefined>;

  /**
   * Gets the consensus for a decision
   * @param decisionId - The decision ID
   * @returns The consensus if exists, undefined otherwise
   */
  getConsensus(decisionId: string): Promise<Consensus | undefined>;

  /**
   * Gets all activity logs (system-generated, immutable)
   * @returns Array of activity logs sorted by timestamp (newest first)
   */
  getActivityLogs(): Promise<ActivityLog[]>;
}

/**
 * In-memory storage implementation for the Dev³ system.
 * Stores all data in Maps, suitable for development and testing.
 * 
 * @remarks
 * Data is lost when the server restarts. For production use,
 * implement a persistent storage solution using the IStorage interface.
 */
export class MemStorage implements IStorage {
  private decisions: Map<string, Decision>;
  private aiResponses: Map<string, AIResponse[]>;
  private consensuses: Map<string, Consensus>;
  private activityLogs: ActivityLog[];

  constructor() {
    this.decisions = new Map();
    this.aiResponses = new Map();
    this.consensuses = new Map();
    this.activityLogs = [];
  }

  private logActivity(
    type: ActivityType,
    decisionId?: string,
    decisionTitle?: string,
    outcome?: string,
    metadata?: Record<string, unknown>
  ): void {
    const log: ActivityLog = {
      id: randomUUID(),
      type,
      decisionId,
      decisionTitle,
      outcome,
      metadata,
      timestamp: new Date().toISOString(),
    };
    this.activityLogs.push(log);
  }

  async createDecision(insertDecision: InsertDecision): Promise<Decision> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const decision: Decision = {
      ...insertDecision,
      id,
      status: "pending",
      responses: [],
      consensus: null,
      createdAt: now,
      updatedAt: now,
    };
    this.decisions.set(id, decision);
    this.aiResponses.set(id, []);
    
    this.logActivity("decision_created", id, decision.title, undefined, {
      category: decision.category,
      priority: decision.priority,
    });
    
    return decision;
  }

  async getDecision(id: string): Promise<Decision | undefined> {
    const decision = this.decisions.get(id);
    if (!decision) return undefined;
    
    const responses = this.aiResponses.get(id) || [];
    const consensus = this.consensuses.get(id);
    
    return {
      ...decision,
      responses,
      consensus: consensus || null,
    };
  }

  async getAllDecisions(): Promise<Decision[]> {
    const decisions: Decision[] = [];
    const entries = Array.from(this.decisions.entries());
    for (const [id, decision] of entries) {
      const responses = this.aiResponses.get(id) || [];
      const consensus = this.consensuses.get(id);
      decisions.push({
        ...decision,
        responses,
        consensus: consensus || null,
      });
    }
    return decisions.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async updateDecision(id: string, updates: UpdateDecision): Promise<Decision | undefined> {
    const decision = this.decisions.get(id);
    if (!decision) return undefined;

    const updated: Decision = {
      ...decision,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.decisions.set(id, updated);
    
    const responses = this.aiResponses.get(id) || [];
    const consensus = this.consensuses.get(id);
    
    return {
      ...updated,
      responses,
      consensus: consensus || null,
    };
  }

  async deleteDecision(id: string): Promise<boolean> {
    const decision = this.decisions.get(id);
    const existed = this.decisions.has(id);
    
    if (existed && decision) {
      this.logActivity("decision_deleted", id, decision.title);
    }
    
    this.decisions.delete(id);
    this.aiResponses.delete(id);
    this.consensuses.delete(id);
    return existed;
  }

  async addAIResponse(insertResponse: InsertAIResponse): Promise<AIResponse> {
    const id = randomUUID();
    const response: AIResponse = {
      ...insertResponse,
      id,
      createdAt: new Date().toISOString(),
    };
    
    const responses = this.aiResponses.get(insertResponse.decisionId) || [];
    
    // Replace existing response from the same model if present
    const existingIndex = responses.findIndex(r => r.model === response.model);
    if (existingIndex >= 0) {
      responses[existingIndex] = response;
    } else {
      responses.push(response);
    }
    
    this.aiResponses.set(insertResponse.decisionId, responses);
    
    // Update decision status when all models have responded
    const decision = this.decisions.get(insertResponse.decisionId);
    if (decision) {
      const allResponded = AI_MODELS.every(model => 
        responses.some(r => r.model === model)
      );
      if (allResponded && decision.status === "pending") {
        decision.status = "deliberating";
        decision.updatedAt = new Date().toISOString();
        this.decisions.set(insertResponse.decisionId, decision);
        
        this.logActivity("deliberation_started", decision.id, decision.title);
      }
    }
    
    return response;
  }

  async getAIResponses(decisionId: string): Promise<AIResponse[]> {
    return this.aiResponses.get(decisionId) || [];
  }

  async setConsensus(
    decisionId: string, 
    consensusData: Omit<Consensus, "id" | "decisionId" | "createdAt">
  ): Promise<Consensus | undefined> {
    const decision = this.decisions.get(decisionId);
    if (!decision) return undefined;

    const id = randomUUID();
    const consensus: Consensus = {
      ...consensusData,
      id,
      decisionId,
      createdAt: new Date().toISOString(),
    };
    
    this.consensuses.set(decisionId, consensus);
    
    // Update decision status
    decision.status = "consensus_reached";
    decision.updatedAt = new Date().toISOString();
    this.decisions.set(decisionId, decision);
    
    // Log the deliberation outcome
    this.logActivity("deliberation_completed", decisionId, decision.title, consensus.outcome, {
      unanimity: consensus.unanimity,
      votes: consensus.voteSummary,
    });
    
    // Log specific consensus outcome
    const outcomeType = consensus.outcome === "approved" 
      ? "consensus_approved" 
      : consensus.outcome === "rejected" 
        ? "consensus_rejected" 
        : "consensus_needs_revision";
    this.logActivity(outcomeType, decisionId, decision.title, consensus.outcome, {
      unanimity: consensus.unanimity,
    });
    
    return consensus;
  }

  async getConsensus(decisionId: string): Promise<Consensus | undefined> {
    return this.consensuses.get(decisionId);
  }

  async getActivityLogs(): Promise<ActivityLog[]> {
    return [...this.activityLogs].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }
}

/** Singleton storage instance */
export const storage = new MemStorage();
