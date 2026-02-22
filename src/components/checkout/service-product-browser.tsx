"use client"

import React, { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Search,
  Scissors,
  ShoppingBag,
  Plus,
  Clock,
  Package,
  AlertTriangle,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { cn, formatCurrency, formatDuration } from "@/lib/utils"
import { QuickSaleButton } from "./quick-sale-button"

interface ServiceItem {
  id: string
  name: string
  description: string
  duration: number
  price: number
  category: string
  isActive: boolean
}

interface ProductItem {
  id: string
  name: string
  description: string
  category: string
  retailPrice: number
  stockLevel: number
  reorderLevel: number
  isActive: boolean
}

interface ServiceProductBrowserProps {
  services: ServiceItem[]
  products: ProductItem[]
  productCategories: string[]
  onAddService: (service: {
    id: string
    name: string
    price: number
    category: string
  }) => void
  onAddProduct: (product: {
    id: string
    name: string
    price: number
    category: string
  }) => void
  onAddQuickSale: (amount: number, description: string) => void
}

type BrowseTab = "services" | "products"

// Map categories to border colors for visual identification
const serviceCategoryColors: Record<string, string> = {
  Hair: "border-l-orange-400",
  Wellness: "border-l-emerald-400",
  Nails: "border-l-pink-400",
  Skincare: "border-l-cyan-400",
  "Brows & Lashes": "border-l-purple-400",
  Body: "border-l-teal-400",
}

const productCategoryColors: Record<string, string> = {
  "Hair Care": "border-l-orange-400",
  Skincare: "border-l-cyan-400",
  "Nail Care": "border-l-pink-400",
  "Tools & Equipment": "border-l-slate-400",
  Wellness: "border-l-emerald-400",
}

export function ServiceProductBrowser({
  services,
  products,
  productCategories: prodCategoryList,
  onAddService,
  onAddProduct,
  onAddQuickSale,
}: ServiceProductBrowserProps) {
  const [activeTab, setActiveTab] = useState<BrowseTab>("services")
  const [searchQuery, setSearchQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState<string>("All")

  // Derive unique service categories
  const serviceCategories = useMemo(() => {
    const cats = Array.from(new Set(services.map((s) => s.category)))
    return ["All", ...cats]
  }, [services])

  // Derive product categories (with "All")
  const prodCategories = useMemo(() => {
    return ["All", ...prodCategoryList]
  }, [prodCategoryList])

  const categories =
    activeTab === "services" ? serviceCategories : prodCategories

  // Filter services
  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      if (!service.isActive) return false
      const matchesSearch =
        service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        service.description.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory =
        activeCategory === "All" || service.category === activeCategory
      return matchesSearch && matchesCategory
    })
  }, [services, searchQuery, activeCategory])

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      if (!product.isActive) return false
      const matchesSearch =
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory =
        activeCategory === "All" || product.category === activeCategory
      return matchesSearch && matchesCategory
    })
  }, [products, searchQuery, activeCategory])

  // Reset category when switching tabs
  const handleTabSwitch = (tab: BrowseTab) => {
    setActiveTab(tab)
    setActiveCategory("All")
    setSearchQuery("")
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header with tab toggle */}
      <div className="space-y-4 pb-4">
        {/* Services / Products toggle */}
        <div className="flex rounded-lg border bg-muted p-1">
          <button
            onClick={() => handleTabSwitch("services")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all",
              activeTab === "services"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Scissors className="h-4 w-4" />
            Services
          </button>
          <button
            onClick={() => handleTabSwitch("products")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all",
              activeTab === "products"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ShoppingBag className="h-4 w-4" />
            Products
          </button>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={
              activeTab === "services"
                ? "Search services..."
                : "Search products..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Category pills */}
        <ScrollArea className="w-full">
          <div className="flex gap-2 pb-1">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                  activeCategory === category
                    ? "border-sal-500 bg-sal-50 text-sal-700"
                    : "border-border bg-background text-muted-foreground hover:border-sal-300 hover:text-foreground"
                )}
              >
                {category}
              </button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Grid */}
      <div className="relative flex-1 overflow-y-auto pr-1">
        <AnimatePresence mode="wait">
          {activeTab === "services" ? (
            <motion.div
              key="services"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
            >
              {filteredServices.map((service, idx) => (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                >
                  <button
                    onClick={() =>
                      onAddService({
                        id: service.id,
                        name: service.name,
                        price: service.price,
                        category: service.category,
                      })
                    }
                    className={cn(
                      "group relative flex w-full flex-col rounded-xl border-l-4 border border-border bg-card p-4 text-left shadow-sm transition-all hover:shadow-md hover:border-sal-200",
                      serviceCategoryColors[service.category] ||
                        "border-l-gray-400"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {service.name}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                          {service.description}
                        </p>
                      </div>
                      <div className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sal-500 text-white">
                          <Plus className="h-4 w-4" />
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDuration(service.duration)}
                      </div>
                      <span className="text-sm font-bold text-sal-600">
                        {formatCurrency(service.price)}
                      </span>
                    </div>
                  </button>
                </motion.div>
              ))}

              {filteredServices.length === 0 && (
                <div className="col-span-full py-12 text-center">
                  <Scissors className="mx-auto h-8 w-8 text-muted-foreground/40" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    No services found
                  </p>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="products"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
            >
              {filteredProducts.map((product, idx) => {
                const isLowStock = product.stockLevel <= product.reorderLevel
                const isOutOfStock = product.stockLevel === 0
                return (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                  >
                    <button
                      onClick={() =>
                        !isOutOfStock &&
                        onAddProduct({
                          id: product.id,
                          name: product.name,
                          price: product.retailPrice,
                          category: product.category,
                        })
                      }
                      disabled={isOutOfStock}
                      className={cn(
                        "group relative flex w-full flex-col rounded-xl border-l-4 border border-border bg-card p-4 text-left shadow-sm transition-all",
                        isOutOfStock
                          ? "cursor-not-allowed opacity-50"
                          : "hover:shadow-md hover:border-sal-200",
                        productCategoryColors[product.category] ||
                          "border-l-gray-400"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">
                            {product.name}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                            {product.description}
                          </p>
                        </div>
                        {!isOutOfStock && (
                          <div className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sal-500 text-white">
                              <Plus className="h-4 w-4" />
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          {isOutOfStock ? (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                              Out of Stock
                            </Badge>
                          ) : isLowStock ? (
                            <span className="flex items-center gap-1 text-[10px] text-amber-600">
                              <AlertTriangle className="h-3 w-3" />
                              {product.stockLevel} left
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Package className="h-3 w-3" />
                              {product.stockLevel} in stock
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-bold text-sal-600">
                          {formatCurrency(product.retailPrice)}
                        </span>
                      </div>
                    </button>
                  </motion.div>
                )
              })}

              {filteredProducts.length === 0 && (
                <div className="col-span-full py-12 text-center">
                  <ShoppingBag className="mx-auto h-8 w-8 text-muted-foreground/40" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    No products found
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick sale floating button */}
        <QuickSaleButton onAddQuickSale={onAddQuickSale} />
      </div>
    </div>
  )
}
