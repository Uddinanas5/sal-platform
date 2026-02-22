"use client"

import React, { useMemo } from "react"
import { motion } from "framer-motion"
import { Truck, Mail, Package } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { Product } from "@/data/mock-products"
import { toast } from "sonner"

interface SupplierInfo {
  name: string
  productCount: number
}

interface SupplierSectionProps {
  products: Product[]
}

export function SupplierSection({ products }: SupplierSectionProps) {
  const suppliers = useMemo<SupplierInfo[]>(() => {
    const supplierMap = new Map<string, number>()
    products.forEach((product) => {
      const count = supplierMap.get(product.supplier) || 0
      supplierMap.set(product.supplier, count + 1)
    })
    return Array.from(supplierMap.entries())
      .map(([name, productCount]) => ({ name, productCount }))
      .sort((a, b) => b.productCount - a.productCount)
  }, [products])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <Card className="border-cream-200">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-sal-600" />
            <CardTitle className="font-heading">Suppliers</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliers.map((supplier, index) => (
              <motion.div
                key={supplier.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
              >
                <div className="flex items-center justify-between p-4 rounded-xl border border-cream-200 hover:border-sal-200 hover:bg-sal-50/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-sal-100">
                      <Package className="w-5 h-5 text-sal-600" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground text-sm">
                        {supplier.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {supplier.productCount} product
                        {supplier.productCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-sal-700"
                    onClick={() =>
                      toast.info(`Contact form for ${supplier.name} coming soon`)
                    }
                  >
                    <Mail className="w-3.5 h-3.5" />
                    Contact
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
