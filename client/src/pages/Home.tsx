import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Zap, Brain, Shield, CheckCircle, XCircle, AlertCircle, Activity, Clock } from "lucide-react";
import type { Decision, Consensus, AIResponse, ActivityLog } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

const AI_MODELS = {
  grok: { name: "Grok", role: "Risk & Momentum", icon: Zap, color: "text-orange-500" },
  chatgpt: { name: "ChatGPT", role: "Structure & Execution", icon: Brain, color: "text-emerald-500" },
  claude: { name: "Claude", role: "Ethics & Restraint", icon: Shield, color: "text-blue-500" },
};

function VoteIcon({ vote }: { vote: string }) {
  if (vote === "approve") return <CheckCircle className="h-4 w-4 text-green-500" />;
  if (vote === "reject") return <XCircle className="h-4 w-4 text-red-500" />;
  return <AlertCircle className="h-4 w-4 text-yellow-500" />;
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    pending: "secondary",
    deliberating: "outline",
    consensus_reached: "default",
    deadlock: "destructive",
  };
  return <Badge variant={variants[status] || "secondary"}>{status.replace("_", " ")}</Badge>;
}

const ACTIVITY_LABELS: Record<string, { label: string; icon: typeof CheckCircle }> = {
  decision_created: { label: "Decision Created", icon: Plus },
  deliberation_started: { label: "Deliberation Started", icon: Activity },
  deliberation_completed: { label: "Deliberation Completed", icon: CheckCircle },
  consensus_approved: { label: "Approved", icon: CheckCircle },
  consensus_rejected: { label: "Rejected", icon: XCircle },
  consensus_needs_revision: { label: "Needs Revision", icon: AlertCircle },
  decision_deleted: { label: "Decision Deleted", icon: XCircle },
};

function ActivityLogItem({ log }: { log: ActivityLog }) {
  const config = ACTIVITY_LABELS[log.type] || { label: log.type, icon: Activity };
  const Icon = config.icon;
  
  return (
    <div data-testid={`activity-${log.id}`} className="flex items-start gap-3 py-3 border-b last:border-0">
      <div className="mt-0.5">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{config.label}</span>
          {log.outcome && (
            <Badge variant={log.outcome === "approved" ? "default" : log.outcome === "rejected" ? "destructive" : "secondary"}>
              {log.outcome}
            </Badge>
          )}
        </div>
        {log.decisionTitle && (
          <p className="text-sm text-muted-foreground truncate">{log.decisionTitle}</p>
        )}
        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
        </div>
      </div>
    </div>
  );
}

function DecisionCard({ decision }: { decision: Decision }) {
  const responses = decision.responses || [];
  const consensus = decision.consensus as Consensus | null;

  return (
    <Card data-testid={`card-decision-${decision.id}`} className="hover-elevate">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg truncate">{decision.title}</CardTitle>
            <CardDescription className="line-clamp-2 mt-1">{decision.description}</CardDescription>
          </div>
          <StatusBadge status={decision.status} />
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline">{decision.category}</Badge>
          <Badge variant={decision.priority === "critical" ? "destructive" : "secondary"}>
            {decision.priority}
          </Badge>
        </div>
        
        {responses.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="text-sm font-medium text-muted-foreground">AI Responses:</div>
            <div className="grid grid-cols-3 gap-2">
              {responses.map((response: AIResponse) => {
                const model = AI_MODELS[response.model as keyof typeof AI_MODELS];
                const Icon = model?.icon || Brain;
                return (
                  <div key={response.id} className="flex items-center gap-1 text-sm">
                    <Icon className={`h-3 w-3 ${model?.color || ""}`} />
                    <span className="truncate">{model?.name}</span>
                    <VoteIcon vote={response.vote} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {consensus && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Consensus:</span>
              <Badge variant={consensus.outcome === "approved" ? "default" : consensus.outcome === "rejected" ? "destructive" : "secondary"}>
                {consensus.outcome}
              </Badge>
              {consensus.unanimity && <Badge variant="outline">Unanimous</Badge>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NewDecisionDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("feature");
  const [priority, setPriority] = useState("medium");

  const deliberateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/deliberate", {
        title,
        description,
        category,
        priority,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/decisions"] });
      setOpen(false);
      setTitle("");
      setDescription("");
      setCategory("feature");
      setPriority("medium");
      onSuccess();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-new-decision">
          <Plus className="h-4 w-4 mr-2" />
          New Decision
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Submit Decision for AI Deliberation</DialogTitle>
          <DialogDescription>
            Three AI models (Grok, ChatGPT, Claude) will analyze and vote on your decision.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div>
            <label className="text-sm font-medium" htmlFor="title">Title</label>
            <Input
              id="title"
              data-testid="input-decision-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Add Dark Mode"
            />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="description">Description</label>
            <Textarea
              id="description"
              data-testid="input-decision-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the decision and any relevant context..."
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Category</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger data-testid="select-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="feature">Feature</SelectItem>
                  <SelectItem value="architecture">Architecture</SelectItem>
                  <SelectItem value="refactor">Refactor</SelectItem>
                  <SelectItem value="security">Security</SelectItem>
                  <SelectItem value="performance">Performance</SelectItem>
                  <SelectItem value="dependency">Dependency</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Priority</label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger data-testid="select-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            data-testid="button-submit-decision"
            onClick={() => deliberateMutation.mutate()}
            disabled={!title || !description || deliberateMutation.isPending}
            className="w-full"
          >
            {deliberateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                AI Models Deliberating...
              </>
            ) : (
              <>Submit for AI Deliberation</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Home() {
  const { data: decisions, isLoading } = useQuery<Decision[]>({
    queryKey: ["/api/decisions"],
  });

  const { data: activityLogs, isLoading: isLoadingLogs } = useQuery<ActivityLog[]>({
    queryKey: ["/api/activity"],
  });

  return (
    <div className="bg-background">
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
          <div>
            <h1 className="text-2xl font-bold">Decision Dashboard</h1>
            <p className="text-sm text-muted-foreground">Three AI minds. One decision.</p>
          </div>
          <NewDecisionDialog onSuccess={() => {}} />
        </div>
        <section className="mb-8">
          <Card className="bg-gradient-to-br from-primary/10 via-background to-accent/10">
            <CardContent className="p-8">
              <div className="grid md:grid-cols-3 gap-6">
                {Object.entries(AI_MODELS).map(([key, model]) => {
                  const Icon = model.icon;
                  return (
                    <div key={key} className="text-center">
                      <div className={`inline-flex p-3 rounded-full bg-card mb-3 ${model.color}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <h3 className="font-semibold">{model.name}</h3>
                      <p className="text-sm text-muted-foreground">{model.role}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </section>

        <Tabs defaultValue="decisions" className="w-full">
          <TabsList data-testid="tabs-main">
            <TabsTrigger value="decisions" data-testid="tab-decisions">Decisions</TabsTrigger>
            <TabsTrigger value="activity" data-testid="tab-activity">Activity Log</TabsTrigger>
          </TabsList>

          <TabsContent value="decisions" className="mt-6">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : decisions?.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-muted-foreground">No decisions yet. Submit one to get started!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {decisions?.map((decision) => (
                  <DecisionCard key={decision.id} decision={decision} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="activity" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  System Activity
                </CardTitle>
                <CardDescription>
                  Immutable log of executed actions. No manual entries.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingLogs ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : activityLogs?.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No activity yet.</p>
                ) : (
                  <ScrollArea className="h-[500px]">
                    {activityLogs?.map((log) => (
                      <ActivityLogItem key={log.id} log={log} />
                    ))}
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
