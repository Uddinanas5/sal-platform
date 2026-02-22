"use client"

import React, { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Search, Plus, Package, Trash2, Download } from "lucide-react"
import { toast } from "sonner"
import { adjustStock, deleteProduct } from "@/lib/actions/products"
import { exportToCsv, formatCurrency } from "@/lib/utils"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DataTable } from "@/components/ui/data-table"
import { type Product } from "@/data/mock-products"
import { InventoryStats } from "@/components/inventory/inventory-stats"
import { LowStockAlert } from "@/components/inventory/low-stock-alert"
import { getProductColumns } from "@/components/inventory/product-columns"
import { AddProductDialog } from "@/components/inventory/add-product-dialog"
import { StockAdjustmentDialog } from "@/components/inventory/stock-adjustment-dialog"
import { SupplierSection } from "@/components/inventory/supplier-section"

interface InventoryClientProps {
  initialProducts: Product[]
  categories: string[]
}

export function InventoryClient(props: InventoryClientProps) {
  const router = useRouter()
  const [searchValue, setSearchValue] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [stockDialogOpen, setStockDialogOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [showLowStockOnly, setShowLowStockOnly] = useState(false)
  const [products, setProducts] = useState<Product[]>(props.initialProducts)

  const filteredProducts = useMemo(() => {
    let filtered = products

    if (searchValue.trim()) {
      const q = searchValue.toLowerCase()
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.supplier.toLowerCase().includes(q)
      )
    }

    if (showLowStockOnly) {
      filtered = filtered.filter((p) => p.stockLevel <= p.reorderLevel)
    }

    if (categoryFilter && categoryFilter !== "all") {
      filtered = filtered.filter((p) => p.category === categoryFilter)
    }

    return filtered
  }, [searchValue, categoryFilter, showLowStockOnly, products])

  function handleAdjustStock(product: Product) {
    setSelectedProduct(product)
    setStockDialogOpen(true)
  }

  function handleEditProduct(product: Product) {
    setSelectedProduct(product)
    setAddDialogOpen(true)
  }

  function handleViewLowStock() {
    setShowLowStockOnly(true)
    setCategoryFilter("all")
  }

  async function handleQuickAdjust(product: Product, delta: number) {
    const newLevel = Math.max(0, product.stockLevel + delta)

    // Optimistically update local state
    setProducts((prev) =>
      prev.map((p) =>
        p.id === product.id ? { ...p, stockLevel: newLevel } : p
      )
    )
    toast.success(`${product.name} stock ${delta > 0 ? "increased" : "decreased"} to ${newLevel}`)

    const result = await adjustStock(product.id, delta, "Quick adjustment")
    if (!result.success) {
      // Revert on failure
      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id ? { ...p, stockLevel: product.stockLevel } : p
        )
      )
      toast.error(`Failed to adjust stock: ${result.error}`)
    } else {
      router.refresh()
    }
  }

  async function handleBulkDeleteProducts(rows: Product[]) {
    const ids = rows.map((r) => r.id)
    const results = await Promise.all(ids.map((id) => deleteProduct(id)))
    const failures = results.filter((r) => !r.success)

    if (failures.length === 0) {
      toast.success(`Deleted ${ids.length} product${ids.length > 1 ? "s" : ""}`)
      setProducts((prev) => prev.filter((p) => !ids.includes(p.id)))
      router.refresh()
    } else {
      toast.error(`Failed to delete ${failures.length} product(s)`)
    }
  }

  const columns = useMemo(
    () =>
      getProductColumns({
        onAdjustStock: handleAdjustStock,
        onEditProduct: handleEditProduct,
        onQuickAdjust: handleQuickAdjust,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  return (
    <div className="min-h-screen bg-cream">
      <Header title="Inventory" subtitle="Manage your products and stock levels" />

      <div className="p-6 space-y-6">
        {/* Low Stock Alert */}
        <LowStockAlert lowStockCount={products.filter((p) => p.stockLevel <= p.reorderLevel).length} onViewLowStock={handleViewLowStock} />

        {/* Stats */}
        <InventoryStats products={products} categories={props.categories} />

        {/* Products Table Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-cream-200">
            {/* Table Header */}
            <div className="p-6 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-sal-600" />
                  <h2 className="text-lg font-heading font-semibold text-foreground">
                    Products
                  </h2>
                  {showLowStockOnly && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                      Low Stock Only
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      exportToCsv(
                        "inventory-export",
                        ["Name", "SKU", "Category", "Cost Price", "Retail Price", "Stock", "Supplier"],
                        filteredProducts.map((p) => [
                          p.name,
                          p.sku,
                          p.category,
                          formatCurrency(p.costPrice),
                          formatCurrency(p.retailPrice),
                          String(p.stockLevel),
                          p.supplier,
                        ])
                      )
                      toast.success("Inventory exported to CSV")
                    }}
                  >
                    <Download className="w-4 h-4" />
                    Export
                  </Button>
                  <Button
                    onClick={() => {
                      setSelectedProduct(null)
                      setAddDialogOpen(true)
                    }}
                    className="gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Product
                  </Button>
                </div>
              </div>

              {/* Search + Filter Row */}
              <div className="flex flex-col sm:flex-row gap-3 mt-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
                  <Input
                    placeholder="Search products by name..."
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    className="pl-9 bg-cream-50 border-cream-200 focus:bg-white"
                  />
                </div>
                <Select
                  value={categoryFilter}
                  onValueChange={(v) => {
                    setCategoryFilter(v)
                    setShowLowStockOnly(false)
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {props.categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {showLowStockOnly && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowLowStockOnly(false)}
                    className="text-xs whitespace-nowrap"
                  >
                    Clear Filter
                  </Button>
                )}
              </div>
            </div>

            {/* Data Table */}
            <div className="px-6 pb-6">
              <DataTable
                columns={columns}
                data={filteredProducts}
                searchKey="name"
                searchValue={searchValue}
                pageSize={10}
                showColumnToggle
                enableRowSelection
                bulkActions={[
                  {
                    label: "Export",
                    icon: <Download className="h-3.5 w-3.5" />,
                    variant: "outline",
                    onClick: (rows) => toast.success(`Exported ${rows.length} products to CSV`),
                  },
                  {
                    label: "Delete",
                    icon: <Trash2 className="h-3.5 w-3.5" />,
                    variant: "destructive",
                    onClick: (rows) => handleBulkDeleteProducts(rows),
                  },
                ]}
              />
            </div>
          </Card>
        </motion.div>

        {/* Supplier Section */}
        <SupplierSection products={products} />
      </div>

      {/* Dialogs */}
      <AddProductDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} categories={props.categories} />
      <StockAdjustmentDialog
        open={stockDialogOpen}
        onOpenChange={setStockDialogOpen}
        product={selectedProduct}
      />
    </div>
  )
}
