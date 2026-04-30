import { useState } from "react";
import { useListOrders, useUpdateOrderStatus, getListOrdersQueryKey, Order } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Package, ShoppingBag, User, Phone, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  new: { label: "Yangi", color: "bg-blue-500" },
  confirmed: { label: "Tasdiqlandi", color: "bg-yellow-500" },
  delivered: { label: "Yetkazildi", color: "bg-green-500" },
  cancelled: { label: "Bekor", color: "bg-red-500" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] ?? { label: status, color: "bg-gray-500" };
  return (
    <Badge className={`${s.color} text-white border-0`}>{s.label}</Badge>
  );
}

function OrderCard({ order, onUpdate }: { order: Order; onUpdate: (id: number, status: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const items = order.items as {
    productName: string; productCode: string; quantity: number;
    selectedColor?: string | null; price: number; imageUrl?: string | null
  }[];

  return (
    <div className="border rounded-xl bg-card overflow-hidden">
      <div
        className="p-4 cursor-pointer flex items-start gap-3"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-bold text-base">#{order.id}</span>
            <StatusBadge status={order.status} />
            <span className="text-xs text-muted-foreground">
              {format(new Date(order.createdAt), "dd.MM.yyyy HH:mm")}
            </span>
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            {order.guestName && (
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                {order.guestName}
              </span>
            )}
            {order.guestPhone && (
              <a
                href={`tel:${order.guestPhone}`}
                className="flex items-center gap-1 text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                <Phone className="h-3.5 w-3.5" />
                {order.guestPhone}
              </a>
            )}
            <span className="flex items-center gap-1">
              <ShoppingBag className="h-3.5 w-3.5" />
              {items.length} ta mahsulot
            </span>
          </div>
          {order.totalPrice != null && (
            <p className="font-bold text-primary mt-1">
              {Number(order.totalPrice).toLocaleString()} so'm
            </p>
          )}
        </div>
        <div className="flex-shrink-0 flex items-center gap-2">
          <Select
            value={order.status}
            onValueChange={(v) => { onUpdate(order.id, v); }}
          >
            <SelectTrigger className="h-8 w-36 text-xs" onClick={(e) => e.stopPropagation()}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent onClick={(e) => e.stopPropagation()}>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t bg-muted/30 p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Buyurtma tarkibi</p>
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b last:border-0">
              {item.imageUrl && (
                <img src={item.imageUrl} alt={item.productName} className="h-12 w-12 object-cover rounded-lg flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{item.productName}</p>
                <p className="text-xs text-muted-foreground">{item.productCode}</p>
                {item.selectedColor && <Badge variant="outline" className="text-xs mt-0.5">{item.selectedColor}</Badge>}
              </div>
              <div className="text-right text-sm">
                <p className="font-semibold">{item.quantity} ta</p>
                <p className="text-muted-foreground">{Number(item.price).toLocaleString()} so'm</p>
                <p className="font-bold text-primary">{(Number(item.price) * item.quantity).toLocaleString()} so'm</p>
              </div>
            </div>
          ))}
          {order.notes && (
            <div className="mt-2 p-2 bg-yellow-500/10 rounded-lg text-sm">
              <span className="font-medium">Izoh:</span> {order.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminOrders() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { data: orders = [], isLoading } = useListOrders({
    status: statusFilter !== "all" ? statusFilter : undefined,
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateMutation = useUpdateOrderStatus({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        toast({ title: "Holat yangilandi ✅" });
      },
      onError: () => toast({ title: "Xato", variant: "destructive" }),
    },
  });

  function handleUpdate(id: number, status: string) {
    updateMutation.mutate({ id, data: { status } });
  }

  const newCount = (orders as Order[]).filter((o) => o.status === "new").length;

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Buyurtmalar</h1>
          {newCount > 0 && (
            <Badge className="bg-blue-500 text-white border-0">{newCount} yangi</Badge>
          )}
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Holat bo'yicha" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Barchasi</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground">Yuklanmoqda...</div>
      ) : (orders as Order[]).length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
          <Package className="h-12 w-12 opacity-20" />
          <p>Buyurtmalar yo'q</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(orders as Order[]).map((order) => (
            <OrderCard key={order.id} order={order} onUpdate={handleUpdate} />
          ))}
        </div>
      )}
    </div>
  );
}
