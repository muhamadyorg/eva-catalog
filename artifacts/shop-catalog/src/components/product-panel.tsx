import { useState, useRef, useCallback, useEffect } from "react";
import { Product } from "@workspace/api-client-react";
import { useCart } from "./cart-provider";
import { useAuth } from "./auth-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  X, ChevronLeft, ChevronRight, ShoppingCart, Plus, Minus,
  Tag, Hash, Ruler, Palette, Package,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ProductPanelProps {
  product: Product | null;
  onClose: () => void;
  onEdit?: (product: Product) => void;
  canManage?: boolean;
}

function ImageGallery({ images, name }: { images: string[]; name: string }) {
  const [current, setCurrent] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  useEffect(() => { setCurrent(0); }, [images]);

  const prev = useCallback(() => setCurrent((c) => (c - 1 + images.length) % images.length), [images.length]);
  const next = useCallback(() => setCurrent((c) => (c + 1) % images.length), [images.length]);

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.changedTouches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    touchEndX.current = e.changedTouches[0].clientX;
    if (touchStartX.current !== null && touchEndX.current !== null) {
      const diff = touchStartX.current - touchEndX.current;
      if (Math.abs(diff) > 40) diff > 0 ? next() : prev();
    }
  }

  if (images.length === 0) {
    return (
      <div className="w-full aspect-square bg-muted flex items-center justify-center rounded-xl">
        <Package className="h-16 w-16 text-muted-foreground opacity-30" />
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <div
        className="relative aspect-square overflow-hidden rounded-xl bg-muted select-none"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <img
          src={images[current]}
          alt={`${name} ${current + 1}`}
          className="w-full h-full object-cover transition-opacity duration-200"
          key={current}
        />
        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1.5 transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1.5 transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`rounded-full transition-all ${
                    i === current
                      ? "w-4 h-2 bg-white"
                      : "w-2 h-2 bg-white/50 hover:bg-white/80"
                  }`}
                />
              ))}
            </div>
          </>
        )}
        {images.length > 1 && (
          <div className="absolute top-2 right-2 bg-black/40 text-white text-xs px-2 py-0.5 rounded-full">
            {current + 1}/{images.length}
          </div>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors ${
                i === current ? "border-primary" : "border-transparent hover:border-border"
              }`}
            >
              <img src={img} alt={`thumb ${i}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProductPanel({ product, onClose, onEdit, canManage }: ProductPanelProps) {
  const { addItem } = useCart();
  const { user } = useAuth();
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);

  const attrs = (product?.attributes as { key: string; value: string }[] ?? []);
  const colors = attrs.filter((a) => a.key === "Rang").map((a) => a.value);
  const razmer = attrs.filter((a) => a.key === "Razmer" || a.key === "O'lcham").map((a) => a.value).join(", ");
  const otherAttrs = attrs.filter((a) => a.key !== "Rang" && a.key !== "Razmer" && a.key !== "O'lcham");

  const allImages = [
    ...(product?.images as string[] ?? []),
    product?.imageUrl,
  ].filter(Boolean) as string[];

  useEffect(() => {
    setSelectedColor(colors[0] ?? null);
    setQuantity(1);
  }, [product?.id]);

  async function handleAddToCart() {
    if (!product || !user) return;
    setAdding(true);
    try {
      await addItem(product.id, quantity, selectedColor ?? undefined);
    } finally {
      setAdding(false);
    }
  }

  const open = !!product;

  const panelContent = product ? (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0">
        <div>
          <Badge variant="outline" className="text-xs font-mono">{product.productId}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {canManage && onEdit && (
            <Button size="sm" variant="outline" onClick={() => onEdit(product)}>
              Tahrirlash
            </Button>
          )}
          <Button size="icon" variant="ghost" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          <ImageGallery images={allImages} name={product.name} />

          <div>
            <h2 className="text-xl font-bold leading-tight">{product.name}</h2>
            <p className="text-2xl font-bold text-primary mt-1">
              {Number(product.price).toLocaleString()} <span className="text-base font-normal text-muted-foreground">so'm</span>
            </p>
          </div>

          {razmer && (
            <div className="flex items-center gap-2">
              <Ruler className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm text-muted-foreground">O'lcham:</span>
              <span className="text-sm font-medium">{razmer}</span>
            </div>
          )}

          {colors.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Palette className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Rang tanlang:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {colors.map((c) => (
                  <button
                    key={c}
                    onClick={() => setSelectedColor(c)}
                    className={`px-3 py-1.5 rounded-full text-sm border-2 transition-all font-medium ${
                      selectedColor === c
                        ? "border-primary bg-primary text-primary-foreground scale-105"
                        : "border-border hover:border-primary/60"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {otherAttrs.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Xususiyatlar:</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {otherAttrs.map((a, i) => (
                  <div key={i} className="rounded-lg bg-muted/50 p-2">
                    <p className="text-xs text-muted-foreground">{a.key}</p>
                    <p className="text-sm font-medium truncate">{a.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {user && (
        <div className="border-t p-4 flex-shrink-0 space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Miqdor:</span>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <span className="w-8 text-center font-semibold">{quantity}</span>
              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setQuantity((q) => q + 1)}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <span className="ml-auto font-bold text-primary">
              {(Number(product.price) * quantity).toLocaleString()} so'm
            </span>
          </div>
          <Button className="w-full" size="lg" onClick={handleAddToCart} disabled={adding}>
            <ShoppingCart className="h-4 w-4 mr-2" />
            {adding ? "Qo'shilmoqda..." : "Savatga qo'shish"}
          </Button>
        </div>
      )}
    </div>
  ) : null;

  return (
    <>
      <div className={`hidden lg:block fixed top-0 right-0 h-full w-96 xl:w-[420px] border-l bg-background shadow-2xl z-40 transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}>
        {panelContent}
      </div>

      <Sheet open={open && typeof window !== "undefined" && window.innerWidth < 1024} onOpenChange={(o) => !o && onClose()}>
        <SheetContent side="bottom" className="h-[92vh] p-0 rounded-t-2xl">
          {panelContent}
        </SheetContent>
      </Sheet>
    </>
  );
}
