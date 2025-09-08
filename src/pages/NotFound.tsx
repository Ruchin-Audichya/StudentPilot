import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="glass-card max-w-md w-full p-8 text-center animate-fade-in">
        <h1 className="text-6xl font-extrabold gradient-primary bg-clip-text text-transparent mb-3">
          404
        </h1>
        <p className="text-lg text-muted-foreground mb-6">Oops! Page not found</p>
        <Button asChild className="gradient-primary text-white">
          <a href="/" className="inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Return to Home
          </a>
        </Button>
      </Card>
    </div>
  );
};

export default NotFound;
