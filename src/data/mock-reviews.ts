export interface Review {
  id: string
  clientId: string
  clientName: string
  clientAvatar?: string
  rating: number
  comment: string
  serviceId: string
  serviceName: string
  staffId: string
  staffName: string
  date: Date
  response?: string
  responseDate?: Date
  source: "Google" | "Yelp" | "Website" | "App"
  isPublished: boolean
}

export const mockReviews: Review[] = [
  { id: "r1", clientId: "c1", clientName: "Emma Thompson", rating: 5, comment: "Alex always gives me the perfect haircut. The salon is beautiful and everyone is so friendly!", serviceId: "s1", serviceName: "Classic Haircut", staffId: "st1", staffName: "Alex Morgan", date: new Date("2026-02-15"), response: "Thank you so much, Emma! We love having you as a client.", responseDate: new Date("2026-02-15"), source: "Google", isPublished: true },
  { id: "r2", clientId: "c3", clientName: "Sofia Rodriguez", rating: 5, comment: "Best color treatment I've ever had. My hair looks amazing and feels so healthy!", serviceId: "s2", serviceName: "Color Treatment", staffId: "st1", staffName: "Alex Morgan", date: new Date("2026-02-14"), source: "Google", isPublished: true },
  { id: "r3", clientId: "c2", clientName: "Michael Chen", rating: 4, comment: "Great massage, very relaxing. Would have liked it to be a bit longer.", serviceId: "s3", serviceName: "Deep Tissue Massage", staffId: "st2", staffName: "Jessica Lee", date: new Date("2026-02-13"), response: "Thanks Michael! We do offer 90-minute sessions if you'd like a longer experience next time.", responseDate: new Date("2026-02-14"), source: "Yelp", isPublished: true },
  { id: "r4", clientId: "c5", clientName: "Olivia Brown", rating: 5, comment: "The facial treatment was heavenly. My skin has never looked better!", serviceId: "s5", serviceName: "Facial Treatment", staffId: "st2", staffName: "Jessica Lee", date: new Date("2026-02-12"), source: "Website", isPublished: true },
  { id: "r5", clientId: "c4", clientName: "James Wilson", rating: 3, comment: "Good manicure but had to wait 15 minutes past my appointment time.", serviceId: "s4", serviceName: "Manicure & Pedicure", staffId: "st3", staffName: "Daniel Park", date: new Date("2026-02-11"), response: "We apologize for the wait, James. We're working on improving our scheduling.", responseDate: new Date("2026-02-12"), source: "Google", isPublished: true },
  { id: "r6", clientId: "c1", clientName: "Emma Thompson", rating: 5, comment: "Sarah did an incredible job with my nails. The attention to detail is unmatched.", serviceId: "s4", serviceName: "Manicure & Pedicure", staffId: "st4", staffName: "Sarah Kim", date: new Date("2026-02-10"), source: "App", isPublished: true },
  { id: "r7", clientId: "c3", clientName: "Sofia Rodriguez", rating: 4, comment: "Love the atmosphere and the service. The products they use are top-notch.", serviceId: "s5", serviceName: "Facial Treatment", staffId: "st4", staffName: "Sarah Kim", date: new Date("2026-02-09"), source: "Google", isPublished: true },
  { id: "r8", clientId: "c2", clientName: "Michael Chen", rating: 5, comment: "Quick and precise beard trim. Daniel really knows what he's doing.", serviceId: "s6", serviceName: "Beard Trim", staffId: "st3", staffName: "Daniel Park", date: new Date("2026-02-08"), source: "Yelp", isPublished: true },
  { id: "r9", clientId: "c5", clientName: "Olivia Brown", rating: 4, comment: "Color came out beautifully. Took a bit long but worth the wait.", serviceId: "s2", serviceName: "Color Treatment", staffId: "st4", staffName: "Sarah Kim", date: new Date("2026-02-07"), source: "Website", isPublished: true },
  { id: "r10", clientId: "c4", clientName: "James Wilson", rating: 5, comment: "Best haircut experience. Very comfortable and professional.", serviceId: "s1", serviceName: "Classic Haircut", staffId: "st1", staffName: "Alex Morgan", date: new Date("2026-02-06"), source: "Google", isPublished: true },
  { id: "r11", clientId: "c1", clientName: "Emma Thompson", rating: 5, comment: "The deep tissue massage was exactly what I needed. Jessica is amazing!", serviceId: "s3", serviceName: "Deep Tissue Massage", staffId: "st2", staffName: "Jessica Lee", date: new Date("2026-02-05"), source: "App", isPublished: true },
  { id: "r12", clientId: "c3", clientName: "Sofia Rodriguez", rating: 4, comment: "Great service as always. The new products smell amazing.", serviceId: "s1", serviceName: "Classic Haircut", staffId: "st3", staffName: "Daniel Park", date: new Date("2026-02-04"), source: "Google", isPublished: true },
  { id: "r13", clientId: "c2", clientName: "Michael Chen", rating: 5, comment: "Excellent facial. My skin feels so refreshed and clean.", serviceId: "s5", serviceName: "Facial Treatment", staffId: "st2", staffName: "Jessica Lee", date: new Date("2026-02-03"), source: "Yelp", isPublished: true },
  { id: "r14", clientId: "c5", clientName: "Olivia Brown", rating: 3, comment: "Haircut was okay but not exactly what I asked for. Will try again.", serviceId: "s1", serviceName: "Classic Haircut", staffId: "st1", staffName: "Alex Morgan", date: new Date("2026-02-02"), source: "Website", isPublished: true },
  { id: "r15", clientId: "c4", clientName: "James Wilson", rating: 5, comment: "Outstanding beard trim and haircut combo. Will definitely be back!", serviceId: "s6", serviceName: "Beard Trim", staffId: "st1", staffName: "Alex Morgan", date: new Date("2026-02-01"), source: "Google", isPublished: true },
  { id: "r16", clientId: "c1", clientName: "Emma Thompson", rating: 4, comment: "Lovely mani-pedi experience. The new gel colors are gorgeous!", serviceId: "s4", serviceName: "Manicure & Pedicure", staffId: "st3", staffName: "Daniel Park", date: new Date("2026-01-30"), source: "App", isPublished: true },
]

export const reviewStats = {
  averageRating: 4.44,
  totalReviews: 16,
  fiveStarCount: 9,
  fourStarCount: 4,
  threeStarCount: 2,
  twoStarCount: 0,
  oneStarCount: 0,
  responseRate: 25,
  ratingTrend: [
    { month: "Sep", rating: 4.2 },
    { month: "Oct", rating: 4.3 },
    { month: "Nov", rating: 4.5 },
    { month: "Dec", rating: 4.4 },
    { month: "Jan", rating: 4.6 },
    { month: "Feb", rating: 4.5 },
  ],
}
