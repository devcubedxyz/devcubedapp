# Dev³ (Dev Cubed)

**Three AI minds. One token. Zero human intervention.**

Dev³ is a fully autonomous Solana token management system where three independent AI models (Grok, ChatGPT, and Claude) collaboratively manage token operations through consensus-based decision making. The system thinks and acts every 30 seconds with no human input required.

**Website:** [devcubed.xyz](https://devcubed.xyz)

## How It Works

### The Three AI Council

Each AI model has a specialized role in the decision-making process:

| Model | Role | Focus |
|-------|------|-------|
| **Grok** (x-ai/grok-3-mini-beta) | Risk & Momentum | Market timing, volatility assessment, edge detection |
| **ChatGPT** (openai/gpt-4o-mini) | Structure & Execution | Technical feasibility, optimal execution paths |
| **Claude** (anthropic/claude-3.5-haiku) | Ethics & Restraint | Long-term sustainability, holder protection |

### Consensus Mechanism

The system uses a **2/3 majority voting** system:

- **2/3 Approve (2+ votes)** → Action is executed
- **2/3 Reject (2+ votes)** → Action is blocked
- **1/3 Split** → Defaults to HOLD (conservative)

This ensures no single AI can unilaterally make decisions that affect token holders.

### Autonomous Actions

The council can vote on five distinct actions:

| Action | Description | When Used |
|--------|-------------|-----------|
| `BUYBACK` | Use treasury SOL to purchase tokens | Bullish market conditions, undervalued token |
| `BURN` | Permanently remove tokens from circulation | Deflationary pressure needed |
| `HOLD` | No action taken | Neutral/uncertain conditions |
| `SELL_PARTIAL` | Sell portion of holdings to build reserves | Risk management, treasury building |
| `CLAIM_REWARDS` | Collect accumulated creator fees | Regular treasury maintenance |

### Decision Cycle

Every 30 seconds, the system:

1. **Gathers Context** - Wallet balance, token holdings, market data
2. **AI Deliberation** - All three models analyze the situation independently
3. **Voting** - Each model votes on the recommended action
4. **Consensus** - System determines if 2/3 majority exists
5. **Execution** - If approved, action is executed via PumpPortal API
6. **Logging** - Decision and outcome recorded immutably

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Dev³ Autonomous Engine                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐                 │
│  │  Grok   │    │ ChatGPT │    │ Claude  │                 │
│  │  Risk   │    │  Logic  │    │ Ethics  │                 │
│  └────┬────┘    └────┬────┘    └────┬────┘                 │
│       │              │              │                       │
│       └──────────────┼──────────────┘                       │
│                      │                                      │
│              ┌───────▼───────┐                              │
│              │   Consensus   │                              │
│              │   (2/3 Vote)  │                              │
│              └───────┬───────┘                              │
│                      │                                      │
│              ┌───────▼───────┐                              │
│              │   Execution   │                              │
│              │  (PumpPortal) │                              │
│              └───────────────┘                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Tech Stack

- **Runtime:** Node.js 18+ with TypeScript
- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Express.js REST API
- **Blockchain:** Solana Web3.js
- **AI Provider:** OpenRouter (unified API for Grok, GPT-4, Claude)
- **Token Operations:** PumpPortal API

## Project Structure

```
├── client/                     # React frontend
│   └── src/
│       ├── components/         # UI components (shadcn/ui)
│       ├── pages/              # Route pages
│       │   ├── Home.tsx        # Manual decision dashboard
│       │   └── Autonomous.tsx  # Autonomous engine monitor
│       └── lib/                # Utilities
├── server/                     # Express backend
│   ├── index.ts                # Server entry point
│   ├── autonomous-engine.ts    # Core 30-second decision loop
│   ├── solana-wallet.ts        # Wallet generation & management
│   ├── pumpportal.ts           # Trading & creator fee API
│   ├── ai-deliberation.ts      # AI model integration
│   ├── routes.ts               # API endpoints
│   └── storage.ts              # Data persistence layer
├── shared/                     # Shared types
│   └── schema.ts               # Zod schemas & TypeScript types
└── README.md
```

## API Reference

### Wallet & Status

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/wallet` | GET | Get wallet address and SOL/token balances |
| `/api/autonomous/status` | GET | Engine running status, cycle count, stats |
| `/api/autonomous/decisions` | GET | Recent autonomous decision history |

### Engine Control

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/autonomous/start` | POST | Start the autonomous engine |
| `/api/autonomous/stop` | POST | Stop the autonomous engine |
| `/api/autonomous/cycle` | POST | Trigger a single decision cycle manually |

### Manual Decision System

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/deliberate` | POST | Create decision + auto-deliberate (one-step) |
| `/api/decisions` | GET/POST | List or create decisions |
| `/api/decisions/:id` | GET/PATCH/DELETE | Manage specific decision |
| `/api/decisions/:id/deliberate` | POST | Trigger AI deliberation |
| `/api/decisions/:id/consensus` | GET/POST | Get or calculate consensus |

## Environment Variables

```env
# Required - OpenRouter API key for AI models
AI_INTEGRATIONS_OPENROUTER_API_KEY=your_openrouter_api_key
AI_INTEGRATIONS_OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# Optional - Session secret for web app
SESSION_SECRET=your_session_secret
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- OpenRouter API key (get one at [openrouter.ai](https://openrouter.ai))

### Installation

```bash
# Clone the repository
git clone https://github.com/devcubedxyz/devcubedapp.git
cd devcubedapp

# Install dependencies
npm install

# Set environment variables
export AI_INTEGRATIONS_OPENROUTER_API_KEY="your_key_here"
export AI_INTEGRATIONS_OPENROUTER_BASE_URL="https://openrouter.ai/api/v1"

# Start development server
npm run dev
```

The application will:
1. Auto-generate a Solana wallet (saved to `.dev3-wallet.json`)
2. Start the autonomous engine with 30-second cycles
3. Begin AI deliberation immediately

Access the dashboard at `http://localhost:5000`

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

## Wallet Management

On first startup, the system automatically generates a new Solana keypair:

```json
{
  "publicKey": "HYjK6mTnWF5RmWjebSyW4WMhyLg1PbFtC8DzBHt9b925",
  "secretKey": [...]
}
```

This wallet is used for:
- Receiving SOL for treasury operations
- Executing buyback/sell transactions
- Holding the managed token
- Paying transaction fees

**Important:** Back up your `.dev3-wallet.json` file securely. Loss of this file means loss of access to funds.

## PumpPortal Integration

Dev³ integrates with PumpPortal for Solana token operations:

| Operation | API Endpoint |
|-----------|--------------|
| Trading (Buy/Sell) | [pumpportal.fun/trading-api](https://pumpportal.fun/trading-api/) |
| Creator Fee Claims | [pumpportal.fun/creator-fee](https://pumpportal.fun/creator-fee/) |

Transactions are signed locally using the auto-generated wallet and submitted through PumpPortal's infrastructure.

## Security Considerations

- Private keys never leave the server environment
- All API keys stored as environment variables (never in code)
- No external access to wallet signing functions
- Immutable activity logging for complete audit trail
- 2/3 consensus required for any action execution

## Example Decision Flow

```
[Cycle Start] 14:30:00
├── Context: 1.5 SOL balance, 10000 tokens held
├── Market: Token price $0.0001, 24h volume $50k
│
├── Grok Analysis:
│   └── Vote: BUYBACK (85% confidence)
│   └── Reason: "Strong momentum, price consolidating above support"
│
├── ChatGPT Analysis:
│   └── Vote: BUYBACK (78% confidence)
│   └── Reason: "Technical indicators suggest accumulation phase"
│
├── Claude Analysis:
│   └── Vote: HOLD (72% confidence)
│   └── Reason: "Prefer caution, suggest smaller position"
│
├── Consensus: BUYBACK (2/3 approve)
├── Execution: Buy 0.1 SOL worth of tokens via PumpPortal
└── Result: Success - acquired 1000 tokens
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Links

- **Website:** [devcubed.xyz](https://devcubed.xyz)
- **GitHub Organization:** [github.com/devcubedxyz](https://github.com/devcubedxyz)
- **Repository:** [github.com/devcubedxyz/devcubedapp](https://github.com/devcubedxyz/devcubedapp)

---

*Built with autonomous intelligence. Operated by consensus. Trusted by code.*
