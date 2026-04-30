import { createContext, useContext, useEffect } from "react";
import { useGetMe, getGetMeQueryKey, UserPublic } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useWebSocket } from "@/hooks/use-websocket";

type AuthContextType = {
  user: (UserPublic & { displayName?: string | null; location?: string | null; phone?: string | null }) | null | undefined;
  isLoading: boolean;
  isAdmin: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: undefined,
  isLoading: true,
  isAdmin: false,
});

function WebSocketAuth({ userId, role }: { userId?: number; role?: string }) {
  useWebSocket(userId, role);
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: user, isLoading, isError } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      retry: false,
      staleTime: 5 * 60 * 1000,
    },
  });

  useEffect(() => {
    if (!isLoading && isError && location !== "/login") {
      setLocation("/login");
    }
  }, [isLoading, isError, location, setLocation]);

  return (
    <AuthContext.Provider
      value={{
        user: (user as AuthContextType["user"]) ?? null,
        isLoading,
        isAdmin: user?.role === "admin",
      }}
    >
      <WebSocketAuth userId={user?.id} role={user?.role} />
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
