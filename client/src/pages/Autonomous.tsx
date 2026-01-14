import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Loader2, 
  Play, 
  Pause, 
  Zap, 
  Brain, 
  Shield, 
  Wallet, 
  Coins,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Activity
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface WalletState {
  wallet: { publicKey: string };
  token: { mint: string; name: string; symbol: string; createdAt: string } | null;
  balance: { sol: number; lamports: number };
}

interface EngineStatus {
  engine: { running: boolean; lastCycle: string | null; decisionsCount: number };
  wallet: { publicKey: string };
  token: { mint: string; name: string; symbol: string } | null;
  balance: { sol: number };
}

interface AutonomousDecision {
  id: string;
  action: string;
  reasoning: string;
  votes: { approve: number; reject: number; abstain: number };
  executed: boolean;
  result?: string;
  timestamp: string;
}

const ACTION_COLORS: Record<string, string> = {
  buyback: "bg-green-500/20 text-green-400 border-green-500/30",
  burn: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  hold: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  sell_partial: "bg-red-500/20 text-red-400 border-red-500/30",
  claim_rewards: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

function DecisionCard({ decision }: { decision: AutonomousDecision }) {
  return (
    <div data-testid={`autonomous-decision-${decision.id}`} className="p-4 border rounded-lg mb-3 bg-card">
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <Badge className={ACTION_COLORS[decision.action] || "bg-muted"}>
          {decision.action.toUpperCase()}
        </Badge>
        <div className="flex items-center gap-2">
          {decision.executed && (
            <Badge variant="outline" className="text-green-400 border-green-400">
              Executed
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(decision.timestamp), { addSuffix: true })}
          </span>
        </div>
      </div>
      
      <div className="flex items-center gap-4 mb-2 text-sm">
        <div className="flex items-center gap-1">
          <Zap className="h-3 w-3 text-orange-400" />
          <Brain className="h-3 w-3 text-emerald-400" />
          <Shield className="h-3 w-3 text-blue-400" />
        </div>
        <span className="text-muted-foreground">
          Votes: {decision.votes.approve} approve, {decision.votes.reject} reject, {decision.votes.abstain} abstain
        </span>
      </div>
      
      {decision.result && (
        <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
          {decision.result}
        </p>
      )}
    </div>
  );
}

export default function Autonomous() {
  const { data: status, isLoading: isLoadingStatus } = useQuery<EngineStatus>({
    queryKey: ["/api/autonomous/status"],
    refetchInterval: 5000,
  });

  const { data: decisions, isLoading: isLoadingDecisions } = useQuery<AutonomousDecision[]>({
    queryKey: ["/api/autonomous/decisions"],
    refetchInterval: 5000,
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/autonomous/start");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/autonomous/status"] });
    },
  });

  const stopMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/autonomous/stop");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/autonomous/status"] });
    },
  });

  const cycleMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/autonomous/cycle");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/autonomous/decisions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/autonomous/status"] });
    },
  });

  const isRunning = status?.engine?.running;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Activity className="h-8 w-8 text-primary" />
                Dev³ Autonomous Engine
              </h1>
              <p className="text-muted-foreground mt-1">
                Three AI minds thinking and acting together
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isRunning ? (
                <Button
                  data-testid="button-stop-engine"
                  variant="destructive"
                  onClick={() => stopMutation.mutate()}
                  disabled={stopMutation.isPending}
                >
                  {stopMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
                  <span className="ml-2">Stop</span>
                </Button>
              ) : (
                <Button
                  data-testid="button-start-engine"
                  onClick={() => startMutation.mutate()}
                  disabled={startMutation.isPending}
                >
                  {startMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  <span className="ml-2">Start</span>
                </Button>
              )}
              <Button
                data-testid="button-run-cycle"
                variant="outline"
                onClick={() => cycleMutation.mutate()}
                disabled={cycleMutation.isPending}
              >
                {cycleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                <span className="ml-2">Run Cycle</span>
              </Button>
            </div>
          </div>
        </header>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Wallet
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingStatus ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <p className="text-2xl font-bold">{status?.balance?.sol?.toFixed(4) || "0"} SOL</p>
                  <p className="text-xs text-muted-foreground truncate mt-1">
                    {status?.wallet?.publicKey || "Loading..."}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Coins className="h-4 w-4" />
                Token
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingStatus ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : status?.token ? (
                <>
                  <p className="text-2xl font-bold">{status.token.symbol}</p>
                  <p className="text-xs text-muted-foreground">{status.token.name}</p>
                </>
              ) : (
                <p className="text-muted-foreground">Not created yet</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Engine Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${isRunning ? "bg-green-500 animate-pulse" : "bg-muted"}`} />
                <span className="text-lg font-semibold">{isRunning ? "Running" : "Stopped"}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {status?.engine?.decisionsCount || 0} decisions made
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <Card className="text-center p-6">
            <Zap className="h-12 w-12 mx-auto mb-3 text-orange-500" />
            <h3 className="font-bold">Grok</h3>
            <p className="text-sm text-muted-foreground">Risk & Momentum</p>
          </Card>
          <Card className="text-center p-6">
            <Brain className="h-12 w-12 mx-auto mb-3 text-emerald-500" />
            <h3 className="font-bold">ChatGPT</h3>
            <p className="text-sm text-muted-foreground">Structure & Execution</p>
          </Card>
          <Card className="text-center p-6">
            <Shield className="h-12 w-12 mx-auto mb-3 text-blue-500" />
            <h3 className="font-bold">Claude</h3>
            <p className="text-sm text-muted-foreground">Ethics & Restraint</p>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Autonomous Decisions</CardTitle>
            <CardDescription>
              Real-time decisions made by the Dev³ AI trinity
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingDecisions ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : !decisions?.length ? (
              <p className="text-center text-muted-foreground py-8">
                No decisions yet. The engine will make its first decision shortly.
              </p>
            ) : (
              <ScrollArea className="h-[400px]">
                {decisions.map((decision) => (
                  <DecisionCard key={decision.id} decision={decision} />
                ))}
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
