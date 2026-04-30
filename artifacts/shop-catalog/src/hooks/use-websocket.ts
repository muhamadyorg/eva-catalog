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
const connListeners = new Set<(connected: boolean) => void>();

let sharedWs: WebSocket | null = null;
let sharedUserId: number | null = null;
let sharedUserRole: string | null = null;
let isConnecting = false;

function notifyConnListeners(connected: boolean) {
  connListeners.forEach((fn) => fn(connected));
}

function connectWs(queryClient: ReturnType<typeof useQueryClient>) {
  if (isConnecting) return;
  if (sharedWs && (sharedWs.readyState === WebSocket.OPEN || sharedWs.readyState === WebSocket.CONNECTING)) return;

  isConnecting = true;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const url = `${protocol}//${window.location.host}/ws`;
  const ws = new WebSocket(url);
  sharedWs = ws;

  ws.onopen = () => {
    isConnecting = false;
    notifyConnListeners(true);
    if (sharedUserId) {
      ws.send(JSON.stringify({ type: "auth", userId: sharedUserId, role: sharedUserRole }));
    }
  };

  ws.onclose = () => {
    isConnecting = false;
    sharedWs = null;
    notifyConnListeners(false);
    setTimeout(() => connectWs(queryClient), 3000);
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
}

export function useWebSocket(userId?: number, userRole?: string) {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(
    () => sharedWs?.readyState === WebSocket.OPEN
  );

  const addListener = useCallback((fn: WsListener) => {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);

  // Auth message yuborish
  useEffect(() => {
    if (!userId) return;
    sharedUserId = userId;
    sharedUserRole = userRole ?? null;
    if (sharedWs && sharedWs.readyState === WebSocket.OPEN) {
      sharedWs.send(JSON.stringify({ type: "auth", userId, role: userRole }));
    }
  }, [userId, userRole]);

  // Connection state listenerini ro'yxatdan o'tkazish
  useEffect(() => {
    const onConn = (connected: boolean) => setIsConnected(connected);
    connListeners.add(onConn);
    return () => { connListeners.delete(onConn); };
  }, []);

  // WebSocket ulanishi
  useEffect(() => {
    connectWs(queryClient);
    setIsConnected(sharedWs?.readyState === WebSocket.OPEN);
  }, [queryClient]);

  return { isConnected, addListener };
}
