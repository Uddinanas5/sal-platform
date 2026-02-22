export interface Transaction {
  id: string
  date: Date
  clientId: string
  clientName: string
  items: { type: "service" | "product"; name: string; price: number; quantity: number }[]
  subtotal: number
  discount: number
  tax: number
  tip: number
  total: number
  paymentMethod: "cash" | "card" | "gift_card" | "split"
  staffId: string
  staffName: string
  status: "completed" | "refunded" | "partial_refund"
}

const today = new Date()
const d = (daysAgo: number) => {
  const date = new Date(today)
  date.setDate(date.getDate() - daysAgo)
  return date
}

export const mockTransactions: Transaction[] = [
  { id: "t1", date: d(0), clientId: "c1", clientName: "Emma Thompson", items: [{ type: "service", name: "Classic Haircut", price: 45, quantity: 1 }, { type: "product", name: "Professional Shampoo", price: 24.99, quantity: 1 }], subtotal: 69.99, discount: 0, tax: 5.60, tip: 10, total: 85.59, paymentMethod: "card", staffId: "st1", staffName: "Alex Morgan", status: "completed" },
  { id: "t2", date: d(0), clientId: "c2", clientName: "Michael Chen", items: [{ type: "service", name: "Deep Tissue Massage", price: 95, quantity: 1 }], subtotal: 95, discount: 0, tax: 7.60, tip: 15, total: 117.60, paymentMethod: "card", staffId: "st2", staffName: "Jessica Lee", status: "completed" },
  { id: "t3", date: d(0), clientId: "c3", clientName: "Sofia Rodriguez", items: [{ type: "service", name: "Color Treatment", price: 150, quantity: 1 }, { type: "service", name: "Classic Haircut", price: 45, quantity: 1 }], subtotal: 195, discount: 20, tax: 14.00, tip: 25, total: 214.00, paymentMethod: "card", staffId: "st1", staffName: "Alex Morgan", status: "completed" },
  { id: "t4", date: d(1), clientId: "c4", clientName: "James Wilson", items: [{ type: "service", name: "Manicure & Pedicure", price: 65, quantity: 1 }], subtotal: 65, discount: 0, tax: 5.20, tip: 8, total: 78.20, paymentMethod: "cash", staffId: "st3", staffName: "Daniel Park", status: "completed" },
  { id: "t5", date: d(1), clientId: "c5", clientName: "Olivia Brown", items: [{ type: "service", name: "Facial Treatment", price: 85, quantity: 1 }, { type: "product", name: "Vitamin C Serum", price: 39.99, quantity: 1 }], subtotal: 124.99, discount: 0, tax: 10.00, tip: 15, total: 149.99, paymentMethod: "card", staffId: "st2", staffName: "Jessica Lee", status: "completed" },
  { id: "t6", date: d(1), clientId: "c1", clientName: "Emma Thompson", items: [{ type: "service", name: "Beard Trim", price: 25, quantity: 1 }], subtotal: 25, discount: 0, tax: 2.00, tip: 5, total: 32.00, paymentMethod: "cash", staffId: "st3", staffName: "Daniel Park", status: "completed" },
  { id: "t7", date: d(2), clientId: "c3", clientName: "Sofia Rodriguez", items: [{ type: "service", name: "Deep Tissue Massage", price: 95, quantity: 1 }, { type: "product", name: "Massage Oil - Lavender", price: 19.99, quantity: 1 }], subtotal: 114.99, discount: 10, tax: 8.40, tip: 20, total: 133.39, paymentMethod: "card", staffId: "st2", staffName: "Jessica Lee", status: "completed" },
  { id: "t8", date: d(2), clientId: "c2", clientName: "Michael Chen", items: [{ type: "service", name: "Classic Haircut", price: 45, quantity: 1 }, { type: "service", name: "Beard Trim", price: 25, quantity: 1 }], subtotal: 70, discount: 0, tax: 5.60, tip: 12, total: 87.60, paymentMethod: "card", staffId: "st1", staffName: "Alex Morgan", status: "completed" },
  { id: "t9", date: d(3), clientId: "c5", clientName: "Olivia Brown", items: [{ type: "service", name: "Classic Haircut", price: 45, quantity: 1 }], subtotal: 45, discount: 0, tax: 3.60, tip: 8, total: 56.60, paymentMethod: "cash", staffId: "st3", staffName: "Daniel Park", status: "completed" },
  { id: "t10", date: d(3), clientId: "c4", clientName: "James Wilson", items: [{ type: "service", name: "Facial Treatment", price: 85, quantity: 1 }], subtotal: 85, discount: 15, tax: 5.60, tip: 10, total: 85.60, paymentMethod: "gift_card", staffId: "st4", staffName: "Sarah Kim", status: "completed" },
  { id: "t11", date: d(4), clientId: "c1", clientName: "Emma Thompson", items: [{ type: "service", name: "Color Treatment", price: 150, quantity: 1 }], subtotal: 150, discount: 0, tax: 12.00, tip: 20, total: 182.00, paymentMethod: "card", staffId: "st4", staffName: "Sarah Kim", status: "completed" },
  { id: "t12", date: d(4), clientId: "c3", clientName: "Sofia Rodriguez", items: [{ type: "service", name: "Manicure & Pedicure", price: 65, quantity: 1 }, { type: "product", name: "Nail Treatment Oil", price: 16.99, quantity: 1 }], subtotal: 81.99, discount: 0, tax: 6.56, tip: 10, total: 98.55, paymentMethod: "card", staffId: "st3", staffName: "Daniel Park", status: "completed" },
  { id: "t13", date: d(5), clientId: "c2", clientName: "Michael Chen", items: [{ type: "service", name: "Deep Tissue Massage", price: 95, quantity: 1 }], subtotal: 95, discount: 0, tax: 7.60, tip: 15, total: 117.60, paymentMethod: "card", staffId: "st2", staffName: "Jessica Lee", status: "completed" },
  { id: "t14", date: d(5), clientId: "c5", clientName: "Olivia Brown", items: [{ type: "service", name: "Facial Treatment", price: 85, quantity: 1 }, { type: "service", name: "Classic Haircut", price: 45, quantity: 1 }], subtotal: 130, discount: 0, tax: 10.40, tip: 18, total: 158.40, paymentMethod: "card", staffId: "st2", staffName: "Jessica Lee", status: "completed" },
  { id: "t15", date: d(6), clientId: "c4", clientName: "James Wilson", items: [{ type: "service", name: "Beard Trim", price: 25, quantity: 1 }], subtotal: 25, discount: 0, tax: 2.00, tip: 5, total: 32.00, paymentMethod: "cash", staffId: "st1", staffName: "Alex Morgan", status: "completed" },
  { id: "t16", date: d(6), clientId: "c1", clientName: "Emma Thompson", items: [{ type: "service", name: "Manicure & Pedicure", price: 65, quantity: 1 }], subtotal: 65, discount: 0, tax: 5.20, tip: 10, total: 80.20, paymentMethod: "card", staffId: "st4", staffName: "Sarah Kim", status: "completed" },
  { id: "t17", date: d(7), clientId: "c3", clientName: "Sofia Rodriguez", items: [{ type: "service", name: "Classic Haircut", price: 45, quantity: 1 }, { type: "product", name: "Styling Gel", price: 14.99, quantity: 1 }], subtotal: 59.99, discount: 0, tax: 4.80, tip: 8, total: 72.79, paymentMethod: "card", staffId: "st1", staffName: "Alex Morgan", status: "completed" },
  { id: "t18", date: d(7), clientId: "c2", clientName: "Michael Chen", items: [{ type: "service", name: "Classic Haircut", price: 45, quantity: 1 }], subtotal: 45, discount: 0, tax: 3.60, tip: 7, total: 55.60, paymentMethod: "cash", staffId: "st3", staffName: "Daniel Park", status: "completed" },
  { id: "t19", date: d(8), clientId: "c5", clientName: "Olivia Brown", items: [{ type: "service", name: "Color Treatment", price: 150, quantity: 1 }], subtotal: 150, discount: 20, tax: 10.40, tip: 20, total: 160.40, paymentMethod: "card", staffId: "st1", staffName: "Alex Morgan", status: "completed" },
  { id: "t20", date: d(8), clientId: "c4", clientName: "James Wilson", items: [{ type: "service", name: "Deep Tissue Massage", price: 95, quantity: 1 }], subtotal: 95, discount: 0, tax: 7.60, tip: 15, total: 117.60, paymentMethod: "card", staffId: "st2", staffName: "Jessica Lee", status: "completed" },
  { id: "t21", date: d(9), clientId: "c1", clientName: "Emma Thompson", items: [{ type: "service", name: "Facial Treatment", price: 85, quantity: 1 }, { type: "product", name: "Hyaluronic Moisturizer", price: 44.99, quantity: 1 }], subtotal: 129.99, discount: 0, tax: 10.40, tip: 15, total: 155.39, paymentMethod: "card", staffId: "st4", staffName: "Sarah Kim", status: "completed" },
  { id: "t22", date: d(9), clientId: "c3", clientName: "Sofia Rodriguez", items: [{ type: "service", name: "Manicure & Pedicure", price: 65, quantity: 1 }], subtotal: 65, discount: 0, tax: 5.20, tip: 10, total: 80.20, paymentMethod: "cash", staffId: "st3", staffName: "Daniel Park", status: "completed" },
  { id: "t23", date: d(10), clientId: "c2", clientName: "Michael Chen", items: [{ type: "service", name: "Classic Haircut", price: 45, quantity: 1 }, { type: "service", name: "Beard Trim", price: 25, quantity: 1 }], subtotal: 70, discount: 0, tax: 5.60, tip: 10, total: 85.60, paymentMethod: "card", staffId: "st1", staffName: "Alex Morgan", status: "completed" },
  { id: "t24", date: d(10), clientId: "c5", clientName: "Olivia Brown", items: [{ type: "service", name: "Deep Tissue Massage", price: 95, quantity: 1 }], subtotal: 95, discount: 10, tax: 6.80, tip: 15, total: 106.80, paymentMethod: "card", staffId: "st2", staffName: "Jessica Lee", status: "completed" },
  { id: "t25", date: d(11), clientId: "c4", clientName: "James Wilson", items: [{ type: "service", name: "Classic Haircut", price: 45, quantity: 1 }], subtotal: 45, discount: 0, tax: 3.60, tip: 7, total: 55.60, paymentMethod: "cash", staffId: "st3", staffName: "Daniel Park", status: "completed" },
  { id: "t26", date: d(11), clientId: "c1", clientName: "Emma Thompson", items: [{ type: "service", name: "Classic Haircut", price: 45, quantity: 1 }, { type: "product", name: "Heat Protectant Spray", price: 19.99, quantity: 1 }], subtotal: 64.99, discount: 0, tax: 5.20, tip: 10, total: 80.19, paymentMethod: "card", staffId: "st1", staffName: "Alex Morgan", status: "completed" },
  { id: "t27", date: d(12), clientId: "c3", clientName: "Sofia Rodriguez", items: [{ type: "service", name: "Color Treatment", price: 150, quantity: 1 }, { type: "service", name: "Classic Haircut", price: 45, quantity: 1 }], subtotal: 195, discount: 20, tax: 14.00, tip: 25, total: 214.00, paymentMethod: "card", staffId: "st1", staffName: "Alex Morgan", status: "completed" },
  { id: "t28", date: d(12), clientId: "c2", clientName: "Michael Chen", items: [{ type: "service", name: "Facial Treatment", price: 85, quantity: 1 }], subtotal: 85, discount: 0, tax: 6.80, tip: 12, total: 103.80, paymentMethod: "card", staffId: "st4", staffName: "Sarah Kim", status: "completed" },
  { id: "t29", date: d(13), clientId: "c5", clientName: "Olivia Brown", items: [{ type: "service", name: "Manicure & Pedicure", price: 65, quantity: 1 }], subtotal: 65, discount: 0, tax: 5.20, tip: 10, total: 80.20, paymentMethod: "card", staffId: "st4", staffName: "Sarah Kim", status: "completed" },
  { id: "t30", date: d(13), clientId: "c4", clientName: "James Wilson", items: [{ type: "service", name: "Deep Tissue Massage", price: 95, quantity: 1 }, { type: "product", name: "Essential Oil Set", price: 42.99, quantity: 1 }], subtotal: 137.99, discount: 0, tax: 11.04, tip: 18, total: 167.03, paymentMethod: "card", staffId: "st2", staffName: "Jessica Lee", status: "completed" },
]
