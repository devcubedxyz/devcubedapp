import { getWalletState, getBalance, WalletBalance, TokenInfo } from "./solana-wallet";
import { getMarketData, MarketData, buyToken, sellToken, claimCreatorFees, burnTokens } from "./pumpportal";
import { storage } from "./storage";
import OpenAI from "openai";

const openrouter = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY,
});

type AIModel = "grok" | "chatgpt" | "claude";
type ActionType = "buyback" | "burn" | "hold" | "sell_partial" | "claim_rewards";

interface AutonomousContext {
  balance: WalletBalance;
  token: TokenInfo | null;
  market: MarketData | null;
  recentDecisions: string[];
  timestamp: string;
}

interface AIActionRecommendation {
  model: AIModel;
  action: ActionType;
  reasoning: string;
  confidence: number;
  amount?: number;
}

interface AutonomousDecision {
  id: string;
  action: ActionType;
  reasoning: string;
  votes: { approve: number; reject: number; abstain: number };
  executed: boolean;
  result?: string;
  timestamp: string;
}

const MODEL_CONFIGS: Record<AIModel, { model: string; systemPrompt: string }> = {
  grok: {
    model: "x-ai/grok-3-mini-beta",
    systemPrompt: `You are Grok, the Risk & Momentum analyst for Dev³ - an autonomous AI-operated Solana token.

Your role is to analyze market conditions and recommend actions:
- BUYBACK: Use treasury SOL to buy back tokens (bullish momentum)
- BURN: Permanently remove tokens from circulation (deflationary)
- HOLD: Take no action (neutral conditions)
- SELL_PARTIAL: Sell some tokens to build treasury (bearish protection)
- CLAIM_REWARDS: Claim creator rewards from pump.fun

Analyze the market data and wallet state. Focus on:
- Price momentum and trend direction
- Risk/reward ratios
- Optimal timing for actions

Respond with JSON only (no markdown):
{
  "action": "buyback" | "burn" | "hold" | "sell_partial" | "claim_rewards",
  "reasoning": "Your analysis",
  "confidence": 0-100,
  "amount": 0.1
}`,
  },
  chatgpt: {
    model: "openai/gpt-4o-mini",
    systemPrompt: `You are ChatGPT, the Structure & Execution specialist for Dev³ - an autonomous AI-operated Solana token.

Your role is to evaluate the technical feasibility and optimal execution of actions:
- BUYBACK: Use treasury SOL to buy back tokens
- BURN: Permanently remove tokens from circulation
- HOLD: Take no action
- SELL_PARTIAL: Sell some tokens to build treasury
- CLAIM_REWARDS: Claim creator rewards from pump.fun

Focus on:
- Transaction execution feasibility
- Gas optimization and timing
- Treasury management efficiency

Respond with JSON only (no markdown):
{
  "action": "buyback" | "burn" | "hold" | "sell_partial" | "claim_rewards",
  "reasoning": "Your analysis",
  "confidence": 0-100,
  "amount": 0.1
}`,
  },
  claude: {
    model: "anthropic/claude-3.5-haiku:beta",
    systemPrompt: `You are Claude, the Ethics & Restraint advisor for Dev³ - an autonomous AI-operated Solana token.

Your role is to ensure responsible token management:
- BUYBACK: Use treasury SOL to buy back tokens
- BURN: Permanently remove tokens from circulation
- HOLD: Take no action (often the wisest choice)
- SELL_PARTIAL: Sell some tokens to build treasury
- CLAIM_REWARDS: Claim creator rewards from pump.fun

Focus on:
- Long-term sustainability over short-term gains
- Holder protection and fair value
- Ethical considerations in autonomous operation
- Conservative approach to preserve treasury

Respond with JSON only (no markdown):
{
  "action": "buyback" | "burn" | "hold" | "sell_partial" | "claim_rewards",
  "reasoning": "Your analysis",
  "confidence": 0-100,
  "amount": 0.1
}`,
  },
};

function buildContextPrompt(context: AutonomousContext): string {
  return `Current Dev³ Token State:

WALLET BALANCE:
- SOL: ${context.balance.sol.toFixed(4)} SOL

TOKEN INFO:
${context.token ? `- Name: ${context.token.name} (${context.token.symbol})
- Mint: ${context.token.mint}
- Created: ${context.token.createdAt}` : "- Token not yet created"}

MARKET DATA:
${context.market ? `- Price: $${context.market.price.toFixed(8)}
- Market Cap: $${context.market.marketCap.toLocaleString()}
- 24h Volume: $${context.market.volume24h.toLocaleString()}
- 24h Change: ${context.market.priceChange24h.toFixed(2)}%
- Holders: ${context.market.holders}` : "- No market data available (token may not be launched yet)"}

RECENT ACTIONS: ${context.recentDecisions.length > 0 ? context.recentDecisions.join(", ") : "None"}

TIMESTAMP: ${context.timestamp}

Based on this data, what action should Dev³ take? Remember:
- If balance is very low (<0.01 SOL), recommend HOLD to preserve funds
- If no token exists yet, recommend HOLD until token is created
- Be conservative with treasury funds`;
}

async function getAIRecommendation(model: AIModel, context: AutonomousContext): Promise<AIActionRecommendation> {
  const config = MODEL_CONFIGS[model];
  
  const response = await openrouter.chat.completions.create({
    model: config.model,
    messages: [
      { role: "system", content: config.systemPrompt },
      { role: "user", content: buildContextPrompt(context) },
    ],
    max_tokens: 512,
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content || "";
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`No JSON found in ${model} response`);
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    model,
    action: parsed.action || "hold",
    reasoning: parsed.reasoning || "No reasoning provided",
    confidence: parsed.confidence || 50,
    amount: parsed.amount,
  };
}

function determineConsensusAction(recommendations: AIActionRecommendation[]): {
  action: ActionType;
  reasoning: string;
  votes: { approve: number; reject: number; abstain: number };
} {
  const actionCounts: Record<ActionType, number> = {
    buyback: 0,
    burn: 0,
    hold: 0,
    sell_partial: 0,
    claim_rewards: 0,
  };

  for (const rec of recommendations) {
    if (rec.confidence > 30) {
      actionCounts[rec.action]++;
    }
  }

  let consensusAction: ActionType = "hold";
  let maxVotes = 0;

  for (const [action, count] of Object.entries(actionCounts)) {
    if (count > maxVotes) {
      maxVotes = count;
      consensusAction = action as ActionType;
    }
  }

  if (maxVotes < 2) {
    consensusAction = "hold";
  }

  const reasoning = recommendations
    .map(r => `${r.model.toUpperCase()}: ${r.action} (${r.confidence}%) - ${r.reasoning}`)
    .join("\n\n");

  return {
    action: consensusAction,
    reasoning,
    votes: {
      approve: recommendations.filter(r => r.action === consensusAction && r.confidence > 50).length,
      reject: recommendations.filter(r => r.action !== consensusAction && r.confidence > 50).length,
      abstain: recommendations.filter(r => r.confidence <= 50).length,
    },
  };
}

async function executeAction(action: ActionType, context: AutonomousContext): Promise<string> {
  if (!context.token) {
    return "No token created yet - cannot execute action";
  }

  switch (action) {
    case "buyback":
      if (context.balance.sol < 0.01) {
        return "Insufficient SOL for buyback";
      }
      const buyAmount = Math.min(context.balance.sol * 0.1, 0.1);
      const buyResult = await buyToken(context.token.mint, buyAmount);
      return buyResult.success 
        ? `Buyback executed: ${buyAmount} SOL - tx: ${buyResult.signature}` 
        : `Buyback failed: ${buyResult.error}`;

    case "sell_partial":
      const sellResult = await sellToken(context.token.mint, "10%");
      return sellResult.success 
        ? `Sell executed: 10% of tokens - tx: ${sellResult.signature}` 
        : `Sell failed: ${sellResult.error}`;

    case "burn":
      const burnResult = await burnTokens(context.token.mint, 10);
      return burnResult.success 
        ? `Burn executed: 10% of tokens permanently burned - tx: ${burnResult.signature}` 
        : `Burn failed: ${burnResult.error}`;

    case "claim_rewards":
      const claimResult = await claimCreatorFees("pump");
      return claimResult.success 
        ? `Creator fees claimed - tx: ${claimResult.signature}` 
        : `Claim failed: ${claimResult.error}`;

    case "hold":
    default:
      return "No action taken - HOLD";
  }
}

let lastDecisions: AutonomousDecision[] = [];
let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;

export async function runAutonomousCycle(): Promise<AutonomousDecision | null> {
  console.log("[Dev³ Engine] Starting autonomous cycle...");
  
  const { wallet, token } = getWalletState();
  const balance = await getBalance();
  const market = token ? await getMarketData(token.mint) : null;
  
  const context: AutonomousContext = {
    balance,
    token,
    market,
    recentDecisions: lastDecisions.slice(0, 5).map(d => d.action),
    timestamp: new Date().toISOString(),
  };

  console.log(`[Dev³ Engine] Context: ${balance.sol.toFixed(4)} SOL, Token: ${token?.symbol || "none"}`);

  const models: AIModel[] = ["grok", "chatgpt", "claude"];
  
  let recommendations: AIActionRecommendation[];
  try {
    recommendations = await Promise.all(
      models.map(model => getAIRecommendation(model, context))
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Dev³ Engine] AI deliberation failed: ${errorMsg}`);
    
    const failedDecision: AutonomousDecision = {
      id: `auto-${Date.now()}`,
      action: "hold",
      reasoning: `Cycle aborted: AI deliberation failed - ${errorMsg}`,
      votes: { approve: 0, reject: 0, abstain: 3 },
      executed: false,
      result: `ERROR: ${errorMsg}`,
      timestamp: new Date().toISOString(),
    };
    
    lastDecisions.unshift(failedDecision);
    if (lastDecisions.length > 100) {
      lastDecisions = lastDecisions.slice(0, 100);
    }
    
    return failedDecision;
  }

  console.log("[Dev³ Engine] AI Recommendations received:");
  for (const rec of recommendations) {
    console.log(`  ${rec.model}: ${rec.action} (${rec.confidence}%)`);
  }

  const consensus = determineConsensusAction(recommendations);
  console.log(`[Dev³ Engine] Consensus: ${consensus.action}`);

  let result = "Action not executed - HOLD consensus";
  let executed = false;

  if (consensus.action !== "hold" && consensus.votes.approve >= 2) {
    result = await executeAction(consensus.action, context);
    executed = true;
    console.log(`[Dev³ Engine] Execution result: ${result}`);
  }

  const decision: AutonomousDecision = {
    id: `auto-${Date.now()}`,
    action: consensus.action,
    reasoning: consensus.reasoning,
    votes: consensus.votes,
    executed,
    result,
    timestamp: new Date().toISOString(),
  };

  lastDecisions.unshift(decision);
  if (lastDecisions.length > 100) {
    lastDecisions = lastDecisions.slice(0, 100);
  }

  return decision;
}

export function startAutonomousEngine(intervalMs: number = 30000): void {
  if (isRunning) {
    console.log("[Dev³ Engine] Already running");
    return;
  }

  isRunning = true;
  console.log(`[Dev³ Engine] Starting autonomous engine (interval: ${intervalMs}ms)`);

  runAutonomousCycle().catch(console.error);

  intervalId = setInterval(() => {
    runAutonomousCycle().catch(console.error);
  }, intervalMs);
}

export function stopAutonomousEngine(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  isRunning = false;
  console.log("[Dev³ Engine] Autonomous engine stopped");
}

export function getAutonomousDecisions(): AutonomousDecision[] {
  return lastDecisions;
}

export function getEngineStatus(): { running: boolean; lastCycle: string | null; decisionsCount: number } {
  return {
    running: isRunning,
    lastCycle: lastDecisions[0]?.timestamp || null,
    decisionsCount: lastDecisions.length,
  };
}
