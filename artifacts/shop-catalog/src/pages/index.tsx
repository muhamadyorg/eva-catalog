import { useState } from "react";
import { 
  useListCatalogs, 
  useListProducts, 
  useGetCatalogBreadcrumb,
  useCreateCatalog,
  useCreateProduct,
  useUpdateCatalog,
  useUpdateProduct,
  useDeleteCatalog,
  useDeleteProduct,
  useBulkDeleteProducts,
  useBulkMoveProducts,
  getListCatalogsQueryKey,
  getListProductsQueryKey,
  getGetCatalogBreadcrumbQueryKey,
  getGetCatalogQueryKey,
  Catalog,
  Product
} from "@workspace/api-client-react";
import { useAuth } from "@/components/auth-provider";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  FolderOpen, 
  Package, 
  Plus, 
  ChevronRight, 
  Grid2X2, 
  Grid3X3, 
  List as ListIcon,
  Image as ImageIcon,
  MoreVertical,
  Edit,
  Trash,
  MoveRight,
  FolderPlus,
  PackagePlus,
  CheckSquare
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

type ViewSize = "small" | "medium" | "large";

export default function CatalogBrowser() {
  const [currentParentId, setCurrentParentId] = useState<number | null>(null);
  const [viewSize, setViewSize] = useState<ViewSize>("medium");
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  
  // Dialogs state
  const [createCatalogOpen, setCreateCatalogOpen] = useState(false);
  const [createProductOpen, setCreateProductOpen] = useState(false);

  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: catalogs, isLoading: catalogsLoading } = useListCatalogs({ parentId: currentParentId });
  const { data: products, isLoading: productsLoading } = useListProducts(
    { catalogId: currentParentId! }, 
    { query: { enabled: currentParentId !== null } }
  );
  const { data: breadcrumbs } = useGetCatalogBreadcrumb(currentParentId!, {
    query: { enabled: currentParentId !== null }
  });

  const isShowingCatalogs = !currentParentId || (catalogs && catalogs.length > 0) || (!catalogsLoading && !productsLoading && catalogs?.length === 0 && products?.length === 0);
  const isShowingProducts = currentParentId && !isShowingCatalogs && products && products.length > 0;

  // Mutations
  const createCatalog = useCreateCatalog({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCatalogsQueryKey() });
        setCreateCatalogOpen(false);
        toast({ title: "Catalog created" });
      },
      onError: (err) => toast({ title: "Error", description: err.error, variant: "destructive" })
    }
  });

  const createProduct = useCreateProduct({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListCatalogsQueryKey() });
        setCreateProductOpen(false);
        toast({ title: "Product created" });
      },
      onError: (err) => toast({ title: "Error", description: err.error, variant: "destructive" })
    }
  });

  const bulkDeleteProducts = useBulkDeleteProducts({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListCatalogsQueryKey() });
        setSelectedProductIds([]);
        toast({ title: "Products deleted" });
      },
      onError: (err) => toast({ title: "Error", description: err.error, variant: "destructive" })
    }
  });

  const deleteCatalog = useDeleteCatalog({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCatalogsQueryKey() });
        toast({ title: "Catalog deleted" });
      },
      onError: (err) => toast({ title: "Error", description: err.error, variant: "destructive" })
    }
  });

  const handleNavigate = (id: number | null) => {
    setCurrentParentId(id);
    setSelectedProductIds([]);
  };

  const handleCreateCatalog = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createCatalog.mutate({
      data: {
        name: formData.get("name") as string,
        imageUrl: (formData.get("imageUrl") as string) || null,
        parentId: currentParentId
      }
    });
  };

  const handleCreateProduct = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentParentId) return;
    const formData = new FormData(e.currentTarget);
    createProduct.mutate({
      data: {
        name: formData.get("name") as string,
        price: parseFloat(formData.get("price") as string),
        imageUrl: (formData.get("imageUrl") as string) || null,
        productId: (formData.get("productId") as string) || undefined,
        catalogId: currentParentId,
        attributes: []
      }
    });
  };

  const handleBulkDelete = () => {
    if (window.confirm(`Delete ${selectedProductIds.length} products?`)) {
      bulkDeleteProducts.mutate({ data: { ids: selectedProductIds } });
    }
  };

  const toggleProductSelection = (id: number) => {
    setSelectedProductIds(prev => 
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  };

  const toggleAllProducts = () => {
    if (!products) return;
    if (selectedProductIds.length === products.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(products.map(p => p.id));
    }
  };

  const getSizeClasses = () => {
    switch (viewSize) {
      case "small": return "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3";
      case "medium": return "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4";
      case "large": return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-4 rounded-xl border shadow-sm">
        
        {/* Breadcrumbs */}
        <div className="flex items-center text-sm font-medium text-muted-foreground overflow-x-auto whitespace-nowrap pb-1 sm:pb-0 scrollbar-hide">
          <button 
            onClick={() => handleNavigate(null)}
            className={`hover:text-foreground transition-colors flex items-center gap-1 ${!currentParentId ? "text-foreground" : ""}`}
          >
            <FolderOpen className="h-4 w-4" />
            Root
          </button>
          
          {breadcrumbs?.map((bc, idx) => (
            <div key={bc.id} className="flex items-center">
              <ChevronRight className="h-4 w-4 mx-1 flex-shrink-0" />
              <button 
                onClick={() => handleNavigate(bc.id)}
                className={`hover:text-foreground transition-colors truncate max-w-[150px] ${idx === breadcrumbs.length - 1 ? "text-foreground" : ""}`}
              >
                {bc.name}
              </button>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2">
          <ToggleGroup type="single" value={viewSize} onValueChange={(v: ViewSize) => v && setViewSize(v)} className="bg-secondary rounded-lg p-1">
            <ToggleGroupItem value="small" aria-label="Small" className="h-8 w-8 px-0"><ListIcon className="h-4 w-4" /></ToggleGroupItem>
            <ToggleGroupItem value="medium" aria-label="Medium" className="h-8 w-8 px-0"><Grid3X3 className="h-4 w-4" /></ToggleGroupItem>
            <ToggleGroupItem value="large" aria-label="Large" className="h-8 w-8 px-0"><Grid2X2 className="h-4 w-4" /></ToggleGroupItem>
          </ToggleGroup>

          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="h-10 ml-2 rounded-lg">
                  <Plus className="h-4 w-4 mr-2" />
                  Create
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setCreateCatalogOpen(true)}>
                  <FolderPlus className="h-4 w-4 mr-2" /> New Catalog
                </DropdownMenuItem>
                {currentParentId && (
                  <DropdownMenuItem onClick={() => setCreateProductOpen(true)}>
                    <PackagePlus className="h-4 w-4 mr-2" /> New Product
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Bulk Actions Toolbar */}
      {selectedProductIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-card border shadow-xl rounded-full px-6 py-3 flex items-center gap-4 z-50 animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-2 font-medium">
            <div className="h-6 w-6 rounded bg-primary/20 text-primary flex items-center justify-center text-xs">
              {selectedProductIds.length}
            </div>
            selected
          </div>
          <div className="w-px h-6 bg-border mx-2" />
          <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={bulkDeleteProducts.isPending} className="rounded-full">
            <Trash className="h-4 w-4 mr-2" /> Delete
          </Button>
          <Button variant="outline" size="sm" className="rounded-full">
            <MoveRight className="h-4 w-4 mr-2" /> Move
          </Button>
        </div>
      )}

      {/* Grid */}
      <div className={`grid ${getSizeClasses()}`}>
        {/* Products View */}
        {isShowingProducts && products?.map(product => (
          <Card 
            key={product.id} 
            className={`group overflow-hidden cursor-pointer hover:border-primary/50 transition-all ${selectedProductIds.includes(product.id) ? "border-primary ring-1 ring-primary" : ""}`}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('.checkbox')) return;
              // Open edit dialog or preview
            }}
          >
            <div className="relative aspect-square bg-secondary/50 flex items-center justify-center">
              {product.imageUrl ? (
                <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <Package className="h-12 w-12 text-muted-foreground/30" />
              )}
              {isAdmin && (
                <div className="absolute top-2 left-2 checkbox" onClick={e => e.stopPropagation()}>
                  <Checkbox 
                    checked={selectedProductIds.includes(product.id)} 
                    onCheckedChange={() => toggleProductSelection(product.id)}
                    className="bg-background/80 backdrop-blur-sm border-muted-foreground/50 data-[state=checked]:border-primary"
                  />
                </div>
              )}
            </div>
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-medium truncate" title={product.name}>{product.name}</h3>
                  <p className="text-sm text-muted-foreground">${product.price.toFixed(2)}</p>
                </div>
                {isAdmin && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 -mt-1 opacity-0 group-hover:opacity-100">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem><Edit className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive focus:bg-destructive/10"><Trash className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Catalogs View */}
        {(isShowingCatalogs || (!products?.length && !catalogs?.length)) && catalogs?.map(catalog => (
          <Card 
            key={catalog.id} 
            className="group cursor-pointer hover:border-primary/50 transition-all hover:shadow-md"
            onClick={() => handleNavigate(catalog.id)}
          >
            <div className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                {catalog.imageUrl ? (
                  <img src={catalog.imageUrl} alt={catalog.name} className="w-full h-full object-cover rounded-xl" />
                ) : (
                  <FolderOpen className="h-6 w-6" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate">{catalog.name}</h3>
                <p className="text-xs text-muted-foreground truncate">
                  {catalog.childCount > 0 ? `${catalog.childCount} folders` : `${catalog.productCount} products`}
                </p>
              </div>
              {isAdmin && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100" onClick={e => e.stopPropagation()}>
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                    <DropdownMenuItem><Edit className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                    <DropdownMenuItem 
                      className="text-destructive focus:bg-destructive/10"
                      onClick={() => {
                        if (window.confirm(`Delete catalog ${catalog.name}?`)) {
                          deleteCatalog.mutate({ id: catalog.id });
                        }
                      }}
                    >
                      <Trash className="h-4 w-4 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </Card>
        ))}

        {!catalogsLoading && !productsLoading && catalogs?.length === 0 && (!products || products.length === 0) && (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-center">
            <div className="h-20 w-20 bg-secondary rounded-full flex items-center justify-center mb-4">
              <PackageSearch className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">Empty Catalog</h3>
            <p className="text-muted-foreground mt-1 max-w-sm">This folder is empty. Create sub-catalogs to organize further, or add products directly here.</p>
            {isAdmin && (
              <div className="flex gap-4 mt-6">
                <Button variant="outline" onClick={() => setCreateCatalogOpen(true)}>
                  <FolderPlus className="h-4 w-4 mr-2" /> Add Catalog
                </Button>
                {currentParentId && (
                  <Button onClick={() => setCreateProductOpen(true)}>
                    <PackagePlus className="h-4 w-4 mr-2" /> Add Product
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Catalog Dialog */}
      <Dialog open={createCatalogOpen} onOpenChange={setCreateCatalogOpen}>
        <DialogContent>
          <form onSubmit={handleCreateCatalog}>
            <DialogHeader>
              <DialogTitle>Create Catalog</DialogTitle>
              <DialogDescription>Add a new folder to organize products.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" required autoFocus />
              </div>
              <div className="space-y-2">
                <Label htmlFor="imageUrl">Image URL (Optional)</Label>
                <div className="flex gap-2">
                  <Input id="imageUrl" name="imageUrl" placeholder="https://..." />
                  <Button type="button" variant="outline" size="icon" className="shrink-0">
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateCatalogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createCatalog.isPending}>Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Product Dialog */}
      <Dialog open={createProductOpen} onOpenChange={setCreateProductOpen}>
        <DialogContent>
          <form onSubmit={handleCreateProduct}>
            <DialogHeader>
              <DialogTitle>Create Product</DialogTitle>
              <DialogDescription>Add a new product to this catalog.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="productName">Name</Label>
                <Input id="productName" name="name" required autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Price</Label>
                  <Input id="price" name="price" type="number" step="0.01" min="0" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="productId">Custom ID (Optional)</Label>
                  <Input id="productId" name="productId" placeholder="SKU-123" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="productImageUrl">Image URL (Optional)</Label>
                <Input id="productImageUrl" name="imageUrl" placeholder="https://..." />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateProductOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createProduct.isPending}>Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
