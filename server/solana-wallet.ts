import { Keypair, Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import bs58 from "bs58";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

const WALLET_FILE = path.join(process.cwd(), ".dev3-wallet.json");
const RPC_ENDPOINT = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

export interface WalletInfo {
  publicKey: string;
  privateKey: string;
  createdAt: string;
}

export interface WalletBalance {
  sol: number;
  lamports: number;
}

export interface TokenInfo {
  mint: string;
  name: string;
  symbol: string;
  createdAt: string;
}

interface WalletState {
  wallet: WalletInfo;
  token: TokenInfo | null;
}

let cachedKeypair: Keypair | null = null;
let cachedState: WalletState | null = null;

export function getConnection(): Connection {
  return new Connection(RPC_ENDPOINT, "confirmed");
}

export function generateWallet(): WalletInfo {
  const keypair = Keypair.generate();
  const wallet: WalletInfo = {
    publicKey: keypair.publicKey.toBase58(),
    privateKey: bs58.encode(keypair.secretKey),
    createdAt: new Date().toISOString(),
  };
  return wallet;
}

export function loadOrCreateWallet(): WalletInfo {
  if (cachedState?.wallet) {
    return cachedState.wallet;
  }

  try {
    if (fs.existsSync(WALLET_FILE)) {
      const data = fs.readFileSync(WALLET_FILE, "utf-8");
      const state: WalletState = JSON.parse(data);
      cachedState = state;
      cachedKeypair = Keypair.fromSecretKey(bs58.decode(state.wallet.privateKey));
      console.log(`[Dev³ Wallet] Loaded existing wallet: ${state.wallet.publicKey}`);
      return state.wallet;
    }
  } catch (error) {
    console.error("[Dev³ Wallet] Error loading wallet:", error);
  }

  const wallet = generateWallet();
  const state: WalletState = { wallet, token: null };
  fs.writeFileSync(WALLET_FILE, JSON.stringify(state, null, 2));
  cachedState = state;
  cachedKeypair = Keypair.fromSecretKey(bs58.decode(wallet.privateKey));
  console.log(`[Dev³ Wallet] Created new wallet: ${wallet.publicKey}`);
  return wallet;
}

export function getKeypair(): Keypair {
  if (!cachedKeypair) {
    const wallet = loadOrCreateWallet();
    cachedKeypair = Keypair.fromSecretKey(bs58.decode(wallet.privateKey));
  }
  return cachedKeypair;
}

export async function getBalance(): Promise<WalletBalance> {
  const connection = getConnection();
  const keypair = getKeypair();
  
  try {
    const lamports = await connection.getBalance(keypair.publicKey);
    return {
      lamports,
      sol: lamports / LAMPORTS_PER_SOL,
    };
  } catch (error) {
    console.error("[Dev³ Wallet] Error getting balance:", error);
    return { lamports: 0, sol: 0 };
  }
}

export function getTokenInfo(): TokenInfo | null {
  if (cachedState?.token) {
    return cachedState.token;
  }
  
  try {
    if (fs.existsSync(WALLET_FILE)) {
      const data = fs.readFileSync(WALLET_FILE, "utf-8");
      const state: WalletState = JSON.parse(data);
      cachedState = state;
      return state.token;
    }
  } catch (error) {
    console.error("[Dev³ Wallet] Error loading token info:", error);
  }
  
  return null;
}

export function setTokenInfo(token: TokenInfo): void {
  const wallet = loadOrCreateWallet();
  const state: WalletState = { wallet, token };
  fs.writeFileSync(WALLET_FILE, JSON.stringify(state, null, 2));
  cachedState = state;
  console.log(`[Dev³ Token] Token registered: ${token.symbol} (${token.mint})`);
}

export function getWalletState(): { wallet: WalletInfo; token: TokenInfo | null; } {
  const wallet = loadOrCreateWallet();
  const token = getTokenInfo();
  return { wallet, token };
}
