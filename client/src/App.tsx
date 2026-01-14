import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Autonomous from "@/pages/Autonomous";
import { Button } from "@/components/ui/button";
import { Activity, LayoutDashboard } from "lucide-react";

function Navigation() {
  const [location] = useLocation();
  
  return (
    <nav className="border-b bg-card">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-4">
        <Link href="/">
          <span className="text-xl font-bold cursor-pointer">Dev³</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/">
            <Button 
              variant={location === "/" ? "secondary" : "ghost"} 
              size="sm"
              data-testid="nav-dashboard"
            >
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
          </Link>
          <Link href="/autonomous">
            <Button 
              variant={location === "/autonomous" ? "secondary" : "ghost"} 
              size="sm"
              data-testid="nav-autonomous"
            >
              <Activity className="h-4 w-4 mr-2" />
              Autonomous
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/autonomous" component={Autonomous} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-background">
          <Navigation />
          <Router />
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
