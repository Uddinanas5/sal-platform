"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Product } from "@/data/mock-products"
import { formatCurrency, cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, Pencil, PackagePlus, Plus, Minus } from "lucide-react"

const categoryColors: Record<string, string> = {
  "Hair Care": "bg-purple-400",
  "Skincare": "bg-pink-400",
  "Nail Care": "bg-rose-400",
  "Tools & Equipment": "bg-blue-400",
  "Wellness": "bg-emerald-400",
}

interface ProductColumnsOptions {
  onAdjustStock: (product: Product) => void
  onEditProduct: (product: Product) => void
  onQuickAdjust?: (product: Product, delta: number) => void
}

export function getProductColumns({
  onAdjustStock,
  onEditProduct,
  onQuickAdjust,
}: ProductColumnsOptions): ColumnDef<Product>[] {
  return [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 h-8"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Name
          <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
        </Button>
      ),
      cell: ({ row }) => {
        const product = row.original
        const dotColor = categoryColors[product.category] || "bg-muted-foreground/50"
        return (
          <div className="flex items-center gap-2.5">
            <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", dotColor)} />
            <div>
              <p className="font-medium text-foreground">{product.name}</p>
              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                {product.description}
              </p>
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: "sku",
      header: "SKU",
      cell: ({ row }) => (
        <span className="font-mono text-sm text-muted-foreground">
          {row.getValue("sku")}
        </span>
      ),
    },
    {
      accessorKey: "category",
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 h-8"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Category
          <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
        </Button>
      ),
      cell: ({ row }) => {
        const category = row.getValue("category") as string
        return (
          <Badge variant="secondary" className="font-normal">
            {category}
          </Badge>
        )
      },
      filterFn: (row, id, value) => {
        return value === "all" || row.getValue(id) === value
      },
    },
    {
      accessorKey: "costPrice",
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 h-8"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Cost Price
          <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatCurrency(row.getValue("costPrice"))}
        </span>
      ),
    },
    {
      accessorKey: "retailPrice",
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 h-8"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Retail Price
          <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="text-sm font-medium">
          {formatCurrency(row.getValue("retailPrice"))}
        </span>
      ),
    },
    {
      accessorKey: "stockLevel",
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 h-8"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Stock
          <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
        </Button>
      ),
      cell: ({ row }) => {
        const product = row.original
        const stock = product.stockLevel
        const reorder = product.reorderLevel

        let colorClasses: string
        let label: string

        if (stock <= reorder / 2) {
          colorClasses = "bg-red-500/10 text-red-700 dark:text-red-300"
          label = "Critical"
        } else if (stock <= reorder) {
          colorClasses = "bg-amber-500/10 text-amber-700 dark:text-amber-300"
          label = "Low"
        } else {
          colorClasses = "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          label = "Good"
        }

        return (
          <div className="group/stock flex items-center gap-2">
            {onQuickAdjust && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 opacity-0 group-hover/stock:opacity-100 transition-opacity"
                onClick={(e) => { e.stopPropagation(); onQuickAdjust(product, -1) }}
                aria-label="Decrease stock"
              >
                <Minus className="h-3 w-3" />
              </Button>
            )}
            <span
              className={cn(
                "inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold tabular-nums",
                colorClasses
              )}
            >
              {stock}
            </span>
            {onQuickAdjust && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 opacity-0 group-hover/stock:opacity-100 transition-opacity"
                onClick={(e) => { e.stopPropagation(); onQuickAdjust(product, 1) }}
                aria-label="Increase stock"
              >
                <Plus className="h-3 w-3" />
              </Button>
            )}
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        )
      },
    },
    {
      accessorKey: "supplier",
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 h-8"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Supplier
          <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="text-sm">{row.getValue("supplier")}</span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const product = row.original
        return (
          <div className="flex items-center gap-1 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAdjustStock(product)}
              className="h-8 text-xs gap-1 text-muted-foreground hover:text-sal-700"
            >
              <PackagePlus className="w-3.5 h-3.5" />
              Adjust Stock
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEditProduct(product)}
              className="h-8 w-8 text-muted-foreground hover:text-sal-700"
              aria-label="Edit product"
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          </div>
        )
      },
    },
  ]
}
