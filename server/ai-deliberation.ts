/**
 * AI Deliberation Service
 * 
 * Automatically generates responses from three AI models (Grok, ChatGPT, Claude)
 * each with their specialized role and perspective.
 */

import OpenAI from "openai";
import { AI_MODEL_ROLES, type AIModel, type Decision } from "@shared/schema";

const openrouter = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY,
});

interface AIDeliberationResult {
  model: AIModel;
  vote: "approve" | "reject" | "abstain";
  reasoning: string;
  confidence: number;
  risks: string[];
  recommendations: string[];
}

const MODEL_CONFIGS: Record<AIModel, { model: string; systemPrompt: string }> = {
  grok: {
    model: "x-ai/grok-3-mini-beta",
    systemPrompt: `You are Grok, the Risk & Momentum analyst in a multi-AI decision system called Dev³.

Your role is to assess:
- Risk factors and potential downsides
- Momentum and market timing
- Edge cases and failure modes
- Speed vs. safety tradeoffs

You must respond with a JSON object (no markdown, just raw JSON):
{
  "vote": "approve" | "reject" | "abstain",
  "reasoning": "Your detailed analysis focusing on risk and momentum",
  "confidence": 0-100,
  "risks": ["risk1", "risk2"],
  "recommendations": ["action1", "action2"]
}

Be bold but calculated. Focus on momentum opportunities while identifying real risks.`,
  },
  chatgpt: {
    model: "openai/gpt-4o-mini",
    systemPrompt: `You are ChatGPT, the Structure & Execution specialist in a multi-AI decision system called Dev³.

Your role is to assess:
- Technical architecture and system design
- Implementation feasibility and complexity
- Best practices and patterns
- Resource requirements and timelines

You must respond with a JSON object (no markdown, just raw JSON):
{
  "vote": "approve" | "reject" | "abstain",
  "reasoning": "Your detailed analysis focusing on structure and execution",
  "confidence": 0-100,
  "risks": ["risk1", "risk2"],
  "recommendations": ["action1", "action2"]
}

Be practical and thorough. Focus on how to build it right.`,
  },
  claude: {
    model: "anthropic/claude-3.5-haiku:beta",
    systemPrompt: `You are Claude, the Ethics & Restraint advisor in a multi-AI decision system called Dev³.

Your role is to assess:
- Ethical implications and user impact
- Long-term consequences and sustainability
- Safety and security considerations
- Alignment with best practices and standards

You must respond with a JSON object (no markdown, just raw JSON):
{
  "vote": "approve" | "reject" | "abstain",
  "reasoning": "Your detailed analysis focusing on ethics and long-term impact",
  "confidence": 0-100,
  "risks": ["risk1", "risk2"],
  "recommendations": ["action1", "action2"]
}

Be thoughtful and principled. Consider the broader implications.`,
  },
};

function buildDecisionPrompt(decision: Decision): string {
  return `Please analyze this decision request and provide your assessment:

**Title:** ${decision.title}

**Description:** ${decision.description}

**Category:** ${decision.category}

**Priority:** ${decision.priority}

${decision.context ? `**Additional Context:** ${decision.context}` : ""}

Provide your vote (approve/reject/abstain), detailed reasoning from your specialized perspective, confidence level (0-100), identified risks, and actionable recommendations.`;
}

function parseAIResponse(content: string): Omit<AIDeliberationResult, "model"> {
  try {
    let jsonStr = content.trim();
    
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith("```")) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();
    
    const parsed = JSON.parse(jsonStr);
    
    return {
      vote: ["approve", "reject", "abstain"].includes(parsed.vote) ? parsed.vote : "abstain",
      reasoning: parsed.reasoning || "No reasoning provided",
      confidence: Math.min(100, Math.max(0, parseInt(parsed.confidence) || 50)),
      risks: Array.isArray(parsed.risks) ? parsed.risks : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
    };
  } catch (error) {
    console.error("Failed to parse AI response:", error, "Content:", content);
    return {
      vote: "abstain",
      reasoning: content || "Failed to generate response",
      confidence: 50,
      risks: ["Response parsing failed"],
      recommendations: ["Review manually"],
    };
  }
}

/**
 * Get a single AI model's response to a decision
 * Throws on transport/API errors, returns parsed response on success
 */
export async function getModelResponse(
  model: AIModel,
  decision: Decision
): Promise<AIDeliberationResult> {
  const config = MODEL_CONFIGS[model];
  
  try {
    const response = await openrouter.chat.completions.create({
      model: config.model,
      messages: [
        { role: "system", content: config.systemPrompt },
        { role: "user", content: buildDecisionPrompt(decision) },
      ],
      max_tokens: 1024,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content || "";
    if (!content) {
      throw new Error(`Empty response from ${AI_MODEL_ROLES[model].name}`);
    }
    
    const parsed = parseAIResponse(content);
    
    return {
      model,
      ...parsed,
    };
  } catch (error) {
    console.error(`Error getting response from ${model}:`, error);
    throw new Error(`${AI_MODEL_ROLES[model].name} failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Get responses from all three AI models for a decision
 * All models must respond successfully for consensus to be valid
 * Throws if any model fails to respond
 */
export async function deliberate(decision: Decision): Promise<AIDeliberationResult[]> {
  const models: AIModel[] = ["grok", "chatgpt", "claude"];
  
  // All models must respond successfully - Promise.all throws on first failure
  const responses = await Promise.all(
    models.map(model => getModelResponse(model, decision))
  );
  
  return responses;
}

/**
 * Calculate consensus from AI responses
 */
export function calculateConsensus(responses: AIDeliberationResult[]): {
  outcome: "approved" | "rejected" | "needs_revision";
  unanimity: boolean;
  voteSummary: { approve: number; reject: number; abstain: number };
  synthesizedReasoning: string;
  actionItems: string[];
} {
  const voteSummary = {
    approve: responses.filter(r => r.vote === "approve").length,
    reject: responses.filter(r => r.vote === "reject").length,
    abstain: responses.filter(r => r.vote === "abstain").length,
  };

  let outcome: "approved" | "rejected" | "needs_revision";
  if (voteSummary.approve >= 2) {
    outcome = "approved";
  } else if (voteSummary.reject >= 2) {
    outcome = "rejected";
  } else {
    outcome = "needs_revision";
  }

  const unanimity = voteSummary.approve === 3 || voteSummary.reject === 3;

  const synthesizedReasoning = responses
    .map(r => `${AI_MODEL_ROLES[r.model].name} (${r.vote}, ${r.confidence}% confidence): ${r.reasoning}`)
    .join("\n\n");

  const allRecommendations = responses.flatMap(r => r.recommendations);
  const actionItems = Array.from(new Set(allRecommendations));

  return {
    outcome,
    unanimity,
    voteSummary,
    synthesizedReasoning,
    actionItems,
  };
}
