import { useState } from "react";
import { useLocation, Redirect } from "wouter";
import { useLogin, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { PackageSearch } from "lucide-react";
import { useAuth } from "@/components/auth-provider";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isLoading } = useAuth();

  const loginMutation = useLogin({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        navigate("/");
      },
      onError: (error) => {
        toast({
          title: "Xato",
          description: (error as { error?: string }).error || "Login yoki parol noto'g'ri",
          variant: "destructive",
        });
      },
    },
  });

  if (!isLoading && user) {
    return <Redirect to="/" />;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    loginMutation.mutate({ data: { username, password } });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center justify-center space-y-2 text-center">
          <div className="h-14 w-14 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center shadow-lg">
            <PackageSearch size={30} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Shop Catalog</h1>
          <p className="text-muted-foreground text-sm">Hisobingizga kiring</p>
        </div>

        <Card className="border-border/50 shadow-xl">
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle className="text-lg">Kirish</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="username">Login</Label>
                <Input
                  id="username"
                  placeholder="admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  disabled={loginMutation.isPending}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Parol</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={loginMutation.isPending}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button
                type="submit"
                className="w-full"
                disabled={loginMutation.isPending || !username || !password}
              >
                {loginMutation.isPending ? "Kirilmoqda..." : "Kirish"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
