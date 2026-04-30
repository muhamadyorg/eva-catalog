import { useState } from "react";
import { useCart } from "./cart-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, X, Trash2, Plus, Minus, ShoppingBag } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

export function CartButton() {
  const { count, openCart } = useCart();
  return (
    <Button
      onClick={openCart}
      variant="ghost"
      size="icon"
      className="relative"
      title="Savat"
    >
      <ShoppingCart className="h-5 w-5" />
      {count > 0 && (
        <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-primary text-primary-foreground">
          {count > 99 ? "99+" : count}
        </Badge>
      )}
    </Button>
  );
}

export function CartDrawer() {
  const { items, isOpen, closeCart, removeItem, updateItem, clearAll, placeOrderNow, count } = useCart();
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [isOrdering, setIsOrdering] = useState(false);
  const [showOrderForm, setShowOrderForm] = useState(false);

  const total = items.reduce((sum, i) => sum + Number(i.product.price) * i.quantity, 0);

  async function handleOrder() {
    if (!guestPhone.trim()) {
      return;
    }
    setIsOrdering(true);
    try {
      await placeOrderNow(guestName || undefined, guestPhone, notes || undefined);
      setGuestName("");
      setGuestPhone("");
      setNotes("");
      setShowOrderForm(false);
    } finally {
      setIsOrdering(false);
    }
  }

  const colors = (product: typeof items[0]["product"]) =>
    (product.attributes as { key: string; value: string }[])
      .filter((a) => a.key === "Rang")
      .map((a) => a.value);

  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && closeCart()}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Savat
            {count > 0 && <Badge variant="secondary">{count} ta</Badge>}
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground p-8">
            <ShoppingBag className="h-16 w-16 opacity-20" />
            <p className="text-lg font-medium">Savat bo'sh</p>
            <p className="text-sm text-center">Mahsulotlarni savatga qo'shing</p>
            <Button variant="outline" onClick={closeCart}>Xarid qilishni boshlash</Button>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 px-4">
              <div className="py-4 space-y-3">
                {items.map((item) => {
                  const productColors = colors(item.product);
                  const allImages = [
                    ...(item.product.images as string[] ?? []),
                    item.product.imageUrl,
                  ].filter(Boolean) as string[];
                  return (
                    <div key={item.id} className="flex gap-3 p-3 rounded-xl border bg-card">
                      {allImages[0] && (
                        <img
                          src={allImages[0]}
                          alt={item.product.name}
                          className="h-16 w-16 object-cover rounded-lg flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-sm truncate">{item.product.name}</p>
                            <p className="text-xs text-muted-foreground">{item.product.productId}</p>
                            {item.selectedColor && (
                              <Badge variant="outline" className="text-xs mt-1">{item.selectedColor}</Badge>
                            )}
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 flex-shrink-0 text-destructive hover:text-destructive"
                            onClick={() => removeItem(item.id)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        {productColors.length > 1 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {productColors.map((c) => (
                              <button
                                key={c}
                                onClick={() => updateItem(item.id, item.quantity, c)}
                                className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                                  item.selectedColor === c
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "border-border hover:border-primary"
                                }`}
                              >
                                {c}
                              </button>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7"
                              onClick={() => {
                                if (item.quantity > 1) updateItem(item.id, item.quantity - 1);
                                else removeItem(item.id);
                              }}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-7 text-center text-sm font-medium">{item.quantity}</span>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7"
                              onClick={() => updateItem(item.id, item.quantity + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <p className="font-semibold text-sm">
                            {(Number(item.product.price) * item.quantity).toLocaleString()} so'm
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="border-t p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-semibold">Jami:</span>
                <span className="text-lg font-bold">{total.toLocaleString()} so'm</span>
              </div>

              {!showOrderForm ? (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearAll}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Tozalash
                  </Button>
                  <Button className="flex-1" onClick={() => setShowOrderForm(true)}>
                    Buyurtma berish
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Separator />
                  <p className="font-medium text-sm">Buyurtma ma'lumotlari</p>
                  <div>
                    <Label htmlFor="cart-name" className="text-xs">Ismingiz</Label>
                    <Input
                      id="cart-name"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="Ism Familiya"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cart-phone" className="text-xs">Telefon *</Label>
                    <Input
                      id="cart-phone"
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      placeholder="+998 90 123 45 67"
                      className="mt-1"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="cart-notes" className="text-xs">Izoh (ixtiyoriy)</Label>
                    <Input
                      id="cart-notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Qo'shimcha ma'lumot..."
                      className="mt-1"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowOrderForm(false)}
                    >
                      Orqaga
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={handleOrder}
                      disabled={isOrdering || !guestPhone.trim()}
                    >
                      {isOrdering ? "Yuborilmoqda..." : "Buyurtmani tasdiqlash"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
