import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListCatalogsQueryKey,
  getListProductsQueryKey,
  getGetCatalogQueryKey,
  getGetCatalogBreadcrumbQueryKey,
} from "@workspace/api-client-react";

type WsListener = (data: Record<string, unknown>) => void;
const listeners = new Set<WsListener>();

let sharedWs: WebSocket | null = null;
let sharedUserId: number | null = null;
let sharedUserRole: string | null = null;

export function useWebSocket(userId?: number, userRole?: string) {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const addListener = useCallback((fn: WsListener) => {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);

  useEffect(() => {
    if (userId) {
      sharedUserId = userId;
      sharedUserRole = userRole ?? null;
      if (sharedWs && sharedWs.readyState === WebSocket.OPEN) {
        sharedWs.send(JSON.stringify({ type: "auth", userId, role: userRole }));
      }
    }
  }, [userId, userRole]);

  useEffect(() => {
    const connect = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(url);
      sharedWs = ws;

      ws.onopen = () => {
        setIsConnected(true);
        if (sharedUserId) {
          ws.send(JSON.stringify({ type: "auth", userId: sharedUserId, role: sharedUserRole }));
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        sharedWs = null;
        reconnectTimer.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as Record<string, unknown>;

          const catalogEvents = ["catalog_created", "catalog_updated", "catalog_deleted", "catalog_moved"];
          const productEvents = ["product_created", "product_updated", "product_deleted", "product_moved", "products_bulk_deleted", "products_bulk_moved"];

          if (catalogEvents.includes(data.type as string)) {
            queryClient.invalidateQueries({ queryKey: getListCatalogsQueryKey() });
            const id = (data.catalog as Record<string, unknown>)?.id || data.id;
            if (id) {
              queryClient.invalidateQueries({ queryKey: getGetCatalogQueryKey(id as number) });
              queryClient.invalidateQueries({ queryKey: getGetCatalogBreadcrumbQueryKey(id as number) });
            }
          } else if (productEvents.includes(data.type as string)) {
            queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          }

          listeners.forEach((fn) => fn(data));
        } catch (_e) {
          //
        }
      };
    };

    if (!sharedWs) {
      connect();
    } else {
      setIsConnected(sharedWs.readyState === WebSocket.OPEN);
    }

    return () => {
      clearTimeout(reconnectTimer.current);
    };
  }, [queryClient]);

  return { isConnected, addListener };
}
