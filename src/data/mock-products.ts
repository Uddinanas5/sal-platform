export interface Product {
  id: string
  name: string
  description: string
  sku: string
  category: string
  costPrice: number
  retailPrice: number
  stockLevel: number
  reorderLevel: number
  supplier: string
  image?: string
  isActive: boolean
}

export const productCategories = ["Hair Care", "Skincare", "Nail Care", "Tools & Equipment", "Wellness"]

export const mockProducts: Product[] = [
  { id: "p1", name: "Professional Shampoo", description: "Salon-grade sulfate-free shampoo", sku: "HC-001", category: "Hair Care", costPrice: 8.50, retailPrice: 24.99, stockLevel: 45, reorderLevel: 10, supplier: "ProBeauty Supply", isActive: true },
  { id: "p2", name: "Deep Conditioner", description: "Intensive repair conditioner for damaged hair", sku: "HC-002", category: "Hair Care", costPrice: 10.00, retailPrice: 29.99, stockLevel: 32, reorderLevel: 10, supplier: "ProBeauty Supply", isActive: true },
  { id: "p3", name: "Hair Color - Blonde", description: "Premium permanent hair color", sku: "HC-003", category: "Hair Care", costPrice: 5.50, retailPrice: 18.99, stockLevel: 8, reorderLevel: 15, supplier: "ColorTech Pro", isActive: true },
  { id: "p4", name: "Hair Color - Brunette", description: "Premium permanent hair color", sku: "HC-004", category: "Hair Care", costPrice: 5.50, retailPrice: 18.99, stockLevel: 12, reorderLevel: 15, supplier: "ColorTech Pro", isActive: true },
  { id: "p5", name: "Styling Gel", description: "Strong hold styling gel", sku: "HC-005", category: "Hair Care", costPrice: 4.00, retailPrice: 14.99, stockLevel: 28, reorderLevel: 10, supplier: "ProBeauty Supply", isActive: true },
  { id: "p6", name: "Heat Protectant Spray", description: "Thermal protection spray", sku: "HC-006", category: "Hair Care", costPrice: 6.00, retailPrice: 19.99, stockLevel: 3, reorderLevel: 10, supplier: "ProBeauty Supply", isActive: true },
  { id: "p7", name: "Vitamin C Serum", description: "Brightening facial serum", sku: "SK-001", category: "Skincare", costPrice: 12.00, retailPrice: 39.99, stockLevel: 20, reorderLevel: 8, supplier: "GlowLab", isActive: true },
  { id: "p8", name: "Hyaluronic Moisturizer", description: "Deep hydrating moisturizer", sku: "SK-002", category: "Skincare", costPrice: 15.00, retailPrice: 44.99, stockLevel: 18, reorderLevel: 8, supplier: "GlowLab", isActive: true },
  { id: "p9", name: "Clay Face Mask", description: "Purifying clay mask", sku: "SK-003", category: "Skincare", costPrice: 8.00, retailPrice: 27.99, stockLevel: 14, reorderLevel: 5, supplier: "GlowLab", isActive: true },
  { id: "p10", name: "SPF 50 Sunscreen", description: "Broad spectrum sunscreen", sku: "SK-004", category: "Skincare", costPrice: 7.00, retailPrice: 22.99, stockLevel: 25, reorderLevel: 10, supplier: "GlowLab", isActive: true },
  { id: "p11", name: "Gel Nail Polish Set", description: "12-color gel polish collection", sku: "NC-001", category: "Nail Care", costPrice: 18.00, retailPrice: 49.99, stockLevel: 6, reorderLevel: 5, supplier: "NailPro Dist.", isActive: true },
  { id: "p12", name: "Nail Treatment Oil", description: "Cuticle and nail strengthening oil", sku: "NC-002", category: "Nail Care", costPrice: 5.00, retailPrice: 16.99, stockLevel: 22, reorderLevel: 8, supplier: "NailPro Dist.", isActive: true },
  { id: "p13", name: "Acrylic Nail Kit", description: "Professional acrylic application kit", sku: "NC-003", category: "Nail Care", costPrice: 25.00, retailPrice: 69.99, stockLevel: 4, reorderLevel: 3, supplier: "NailPro Dist.", isActive: true },
  { id: "p14", name: "UV Nail Lamp", description: "Professional UV/LED nail lamp", sku: "TE-001", category: "Tools & Equipment", costPrice: 35.00, retailPrice: 89.99, stockLevel: 7, reorderLevel: 3, supplier: "SalonTech", isActive: true },
  { id: "p15", name: "Professional Hair Dryer", description: "Ionic ceramic hair dryer", sku: "TE-002", category: "Tools & Equipment", costPrice: 45.00, retailPrice: 129.99, stockLevel: 5, reorderLevel: 2, supplier: "SalonTech", isActive: true },
  { id: "p16", name: "Flat Iron", description: "Titanium plate flat iron", sku: "TE-003", category: "Tools & Equipment", costPrice: 30.00, retailPrice: 79.99, stockLevel: 8, reorderLevel: 3, supplier: "SalonTech", isActive: true },
  { id: "p17", name: "Massage Oil - Lavender", description: "Relaxing lavender massage oil", sku: "WL-001", category: "Wellness", costPrice: 6.00, retailPrice: 19.99, stockLevel: 15, reorderLevel: 8, supplier: "ZenSupply", isActive: true },
  { id: "p18", name: "Aromatherapy Candle", description: "Soy wax aromatherapy candle", sku: "WL-002", category: "Wellness", costPrice: 8.00, retailPrice: 24.99, stockLevel: 20, reorderLevel: 5, supplier: "ZenSupply", isActive: true },
  { id: "p19", name: "Essential Oil Set", description: "Set of 6 pure essential oils", sku: "WL-003", category: "Wellness", costPrice: 15.00, retailPrice: 42.99, stockLevel: 10, reorderLevel: 5, supplier: "ZenSupply", isActive: true },
  { id: "p20", name: "Hot Stone Set", description: "Basalt massage stone set", sku: "WL-004", category: "Wellness", costPrice: 20.00, retailPrice: 54.99, stockLevel: 4, reorderLevel: 2, supplier: "ZenSupply", isActive: true },
]

export const lowStockProducts = mockProducts.filter(p => p.stockLevel <= p.reorderLevel)
