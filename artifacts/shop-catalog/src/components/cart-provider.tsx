import { createContext, useContext, useState } from "react";
import { useGetCart, useAddToCart, useRemoveFromCart, useUpdateCartItem, useClearCart, usePlaceOrder, getGetCartQueryKey, CartItemFull } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "./auth-provider";

interface CartContextType {
  items: CartItemFull[];
  count: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addItem: (productId: number, quantity: number, selectedColor?: string) => Promise<void>;
  removeItem: (id: number) => Promise<void>;
  updateItem: (id: number, quantity: number, selectedColor?: string) => Promise<void>;
  clearAll: () => Promise<void>;
  placeOrderNow: (guestName?: string, guestPhone?: string, notes?: string) => Promise<void>;
  isLoading: boolean;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useGetCart({ query: { queryKey: getGetCartQueryKey(), enabled: !!user } });
  const count = items.reduce((sum, i) => sum + i.quantity, 0);

  const addMutation = useAddToCart({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
        toast({ title: "Savatga qo'shildi ✅" });
      },
      onError: (e) => toast({ title: "Xato", description: (e as { error?: string }).error ?? "Qo'shib bo'lmadi", variant: "destructive" }),
    },
  });

  const removeMutation = useRemoveFromCart({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() }),
      onError: () => toast({ title: "Xato", variant: "destructive" }),
    },
  });

  const updateMutation = useUpdateCartItem({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() }),
    },
  });

  const clearMutation = useClearCart({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() }),
    },
  });

  const placeMutation = usePlaceOrder({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
        setIsOpen(false);
        toast({ title: "Buyurtma berildi! 🎉", description: "Admin tez orada bog'lanadi." });
      },
      onError: (e) => toast({ title: "Xato", description: (e as { error?: string }).error ?? "Buyurtma berib bo'lmadi", variant: "destructive" }),
    },
  });

  async function addItem(productId: number, quantity: number, selectedColor?: string) {
    await addMutation.mutateAsync({ data: { productId, quantity, selectedColor: selectedColor ?? null } });
  }

  async function removeItem(id: number) {
    await removeMutation.mutateAsync({ id });
  }

  async function updateItem(id: number, quantity: number, selectedColor?: string) {
    await updateMutation.mutateAsync({ id, data: { quantity, selectedColor } });
  }

  async function clearAll() {
    await clearMutation.mutateAsync();
  }

  async function placeOrderNow(guestName?: string, guestPhone?: string, notes?: string) {
    await placeMutation.mutateAsync({ data: { guestName, guestPhone, notes } });
  }

  return (
    <CartContext.Provider value={{
      items: items as CartItemFull[],
      count,
      isOpen,
      openCart: () => setIsOpen(true),
      closeCart: () => setIsOpen(false),
      addItem,
      removeItem,
      updateItem,
      clearAll,
      placeOrderNow,
      isLoading,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
