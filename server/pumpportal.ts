import { VersionedTransaction, Connection, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { getKeypair, getConnection, setTokenInfo, getTokenInfo } from "./solana-wallet";

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const BURN_ADDRESS = new PublicKey("1nc1nerator11111111111111111111111111111111");

const PUMPPORTAL_API = "https://pumpportal.fun/api";

export interface TradeParams {
  action: "buy" | "sell";
  mint: string;
  amount: number | string;
  denominatedInSol: boolean;
  slippage: number;
  priorityFee: number;
  pool?: string;
}

export interface TradeResult {
  success: boolean;
  signature?: string;
  error?: string;
}

export interface TokenCreationParams {
  name: string;
  symbol: string;
  description: string;
  twitter?: string;
  telegram?: string;
  website?: string;
}

export async function executeTrade(params: TradeParams): Promise<TradeResult> {
  const keypair = getKeypair();
  const connection = getConnection();

  try {
    const response = await fetch(`${PUMPPORTAL_API}/trade-local`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publicKey: keypair.publicKey.toBase58(),
        action: params.action,
        mint: params.mint,
        amount: params.amount,
        denominatedInSol: params.denominatedInSol.toString(),
        slippage: params.slippage,
        priorityFee: params.priorityFee,
        pool: params.pool || "auto",
      }),
    });

    if (response.status !== 200) {
      const errorText = await response.text();
      return { success: false, error: `PumpPortal error: ${errorText}` };
    }

    const data = await response.arrayBuffer();
    const tx = VersionedTransaction.deserialize(new Uint8Array(data));
    tx.sign([keypair]);
    
    const signature = await connection.sendTransaction(tx);
    console.log(`[Dev³ Trade] Transaction sent: https://solscan.io/tx/${signature}`);
    
    return { success: true, signature };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Dev³ Trade] Error:", message);
    return { success: false, error: message };
  }
}

export async function buyToken(mint: string, solAmount: number): Promise<TradeResult> {
  console.log(`[Dev³ Buyback] Buying ${solAmount} SOL worth of token ${mint}`);
  return executeTrade({
    action: "buy",
    mint,
    amount: solAmount,
    denominatedInSol: true,
    slippage: 10,
    priorityFee: 0.0001,
  });
}

export async function sellToken(mint: string, percentage: string): Promise<TradeResult> {
  console.log(`[Dev³ Sell] Selling ${percentage} of token ${mint}`);
  return executeTrade({
    action: "sell",
    mint,
    amount: percentage,
    denominatedInSol: false,
    slippage: 10,
    priorityFee: 0.0001,
  });
}

export interface MarketData {
  price: number;
  marketCap: number;
  volume24h: number;
  priceChange24h: number;
  holders: number;
}

export async function getMarketData(mint: string): Promise<MarketData | null> {
  try {
    const response = await fetch(`https://frontend-api.pump.fun/coins/${mint}`);
    if (!response.ok) return null;
    
    const data = await response.json();
    return {
      price: data.price || 0,
      marketCap: data.usd_market_cap || 0,
      volume24h: data.volume_24h || 0,
      priceChange24h: data.price_change_24h || 0,
      holders: data.holder_count || 0,
    };
  } catch (error) {
    console.error("[Dev³ Market] Error fetching market data:", error);
    return null;
  }
}

export async function getCreatorRewards(mint: string): Promise<number> {
  return 0;
}

export interface ClaimRewardsResult {
  success: boolean;
  signature?: string;
  error?: string;
}

export async function claimCreatorFees(pool: "pump" | "meteora-dbc" = "pump", mint?: string): Promise<ClaimRewardsResult> {
  const keypair = getKeypair();
  const connection = getConnection();

  try {
    const body: Record<string, any> = {
      publicKey: keypair.publicKey.toBase58(),
      action: "collectCreatorFee",
      priorityFee: 0.000001,
      pool,
    };
    
    if (pool === "meteora-dbc" && mint) {
      body.mint = mint;
    }

    const response = await fetch(`${PUMPPORTAL_API}/trade-local`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (response.status !== 200) {
      const errorText = await response.text();
      return { success: false, error: `PumpPortal error: ${errorText}` };
    }

    const data = await response.arrayBuffer();
    const tx = VersionedTransaction.deserialize(new Uint8Array(data));
    tx.sign([keypair]);
    
    const signature = await connection.sendTransaction(tx);
    console.log(`[Dev³ Rewards] Creator fees claimed: https://solscan.io/tx/${signature}`);
    
    return { success: true, signature };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Dev³ Rewards] Error claiming fees:", message);
    return { success: false, error: message };
  }
}

export async function burnTokens(mint: string, percentage: number = 100): Promise<TradeResult> {
  const keypair = getKeypair();
  const connection = getConnection();
  
  console.log(`[Dev³ Burn] Burning ${percentage}% of tokens for mint ${mint}`);

  try {
    const mintPubkey = new PublicKey(mint);
    
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(keypair.publicKey, {
      mint: mintPubkey,
    });

    if (tokenAccounts.value.length === 0) {
      return { success: false, error: "No token account found for this mint" };
    }

    const tokenAccount = tokenAccounts.value[0];
    const tokenBalance = tokenAccount.account.data.parsed.info.tokenAmount.amount;
    const decimals = tokenAccount.account.data.parsed.info.tokenAmount.decimals;
    
    if (parseInt(tokenBalance) === 0) {
      return { success: false, error: "Token balance is zero" };
    }

    const burnAmount = Math.floor((parseInt(tokenBalance) * percentage) / 100);
    
    const burnInstruction = new TransactionInstruction({
      keys: [
        { pubkey: tokenAccount.pubkey, isSigner: false, isWritable: true },
        { pubkey: mintPubkey, isSigner: false, isWritable: true },
        { pubkey: keypair.publicKey, isSigner: true, isWritable: false },
      ],
      programId: TOKEN_PROGRAM_ID,
      data: Buffer.from([8, ...new Uint8Array(new BigUint64Array([BigInt(burnAmount)]).buffer)]),
    });

    const transaction = new Transaction().add(burnInstruction);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = keypair.publicKey;
    transaction.sign(keypair);

    const signature = await connection.sendRawTransaction(transaction.serialize());
    await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight });
    
    console.log(`[Dev³ Burn] Burned ${burnAmount} tokens: https://solscan.io/tx/${signature}`);
    return { success: true, signature };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Dev³ Burn] Error:", message);
    return { success: false, error: message };
  }
}
