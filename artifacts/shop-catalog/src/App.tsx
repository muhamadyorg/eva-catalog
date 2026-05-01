import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, useAuth } from "@/components/auth-provider";
import { CartProvider } from "@/components/cart-provider";
import { LangProvider } from "@/components/lang-provider";
import { CartDrawer } from "@/components/cart-drawer";
import { Layout } from "@/components/layout";

import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import CatalogBrowser from "@/pages/index";
import AdminUsers from "@/pages/admin/users";
import AdminSettings from "@/pages/admin/settings";
import AdminOrders from "@/pages/admin/orders";
import AdminChat from "@/pages/admin/chat";
import UserChat from "@/pages/chat";

const queryClient = new QueryClient();

function ProtectedRoute({
  component: Component,
  adminOnly = false,
  managerOk = false,
}: {
  component: React.ComponentType;
  adminOnly?: boolean;
  managerOk?: boolean;
}) {
  const { user, isLoading, isAdmin } = useAuth();
  const role = user?.role;

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Yuklanmoqda...</div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (adminOnly && !isAdmin) {
    if (managerOk && role === "manager") {
      // ok
    } else {
      return <Redirect to="/" />;
    }
  }

  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={() => <ProtectedRoute component={CatalogBrowser} />} />
      <Route path="/chat" component={() => <ProtectedRoute component={UserChat} />} />
      <Route path="/admin/orders" component={() => <ProtectedRoute component={AdminOrders} adminOnly managerOk />} />
      <Route path="/admin/chat" component={() => <ProtectedRoute component={AdminChat} adminOnly managerOk />} />
      <Route path="/admin/users" component={() => <ProtectedRoute component={AdminUsers} adminOnly />} />
      <Route path="/admin/settings" component={() => <ProtectedRoute component={AdminSettings} adminOnly />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <LangProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <AuthProvider>
                <CartProvider>
                  <AppRoutes />
                  <CartDrawer />
                </CartProvider>
              </AuthProvider>
            </WouterRouter>
            <Toaster />
          </LangProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
