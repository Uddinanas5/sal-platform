// Mock data for SAL Dashboard

export interface Appointment {
  id: string;
  clientId: string;
  clientName: string;
  clientAvatar?: string;
  serviceId: string;
  serviceName: string;
  staffId: string;
  staffName: string;
  startTime: Date;
  endTime: Date;
  status: 'confirmed' | 'pending' | 'completed' | 'cancelled' | 'no-show' | 'checked-in' | 'in-progress';
  price: number;
  notes?: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  totalVisits: number;
  totalSpent: number;
  lastVisit?: Date;
  createdAt: Date;
  tags?: string[];
  notes?: string;
  loyaltyPoints?: number;
  dateOfBirth?: Date;
  walletBalance?: number;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  duration: number; // in minutes
  price: number;
  category: string;
  color: string;
  isActive: boolean;
  processingTime?: number;
}

export interface Staff {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  role: 'admin' | 'manager' | 'staff';
  services: string[]; // service IDs
  workingHours: {
    [day: string]: { start: string; end: string } | null;
  };
  color: string;
  isActive: boolean;
  commission?: number;
}

// 25 Clients
export const mockClients: Client[] = [
  { id: 'c1', name: 'Emma Thompson', email: 'emma@example.com', phone: '+1 (555) 123-4567', avatar: '/avatars/emma.jpg', totalVisits: 24, totalSpent: 2450, lastVisit: new Date('2026-02-10'), createdAt: new Date('2024-06-15'), tags: ['VIP', 'Regular'], loyaltyPoints: 480, dateOfBirth: new Date('1990-03-15'), walletBalance: 150 },
  { id: 'c2', name: 'Michael Chen', email: 'michael@example.com', phone: '+1 (555) 234-5678', totalVisits: 12, totalSpent: 980, lastVisit: new Date('2026-02-08'), createdAt: new Date('2024-09-20'), tags: ['New'], loyaltyPoints: 120 },
  { id: 'c3', name: 'Sofia Rodriguez', email: 'sofia@example.com', phone: '+1 (555) 345-6789', totalVisits: 36, totalSpent: 4200, lastVisit: new Date('2026-02-12'), createdAt: new Date('2023-11-05'), tags: ['VIP', 'Loyal'], loyaltyPoints: 860, dateOfBirth: new Date('1988-07-22'), walletBalance: 250 },
  { id: 'c4', name: 'James Wilson', email: 'james@example.com', phone: '+1 (555) 456-7890', totalVisits: 8, totalSpent: 640, lastVisit: new Date('2026-02-05'), createdAt: new Date('2025-01-10'), loyaltyPoints: 85 },
  { id: 'c5', name: 'Olivia Brown', email: 'olivia@example.com', phone: '+1 (555) 567-8901', totalVisits: 18, totalSpent: 1800, lastVisit: new Date('2026-02-11'), createdAt: new Date('2024-04-22'), tags: ['Regular'], loyaltyPoints: 320, walletBalance: 75 },
  { id: 'c6', name: 'Ava Martinez', email: 'ava@example.com', phone: '+1 (555) 678-9012', totalVisits: 15, totalSpent: 1350, lastVisit: new Date('2026-02-14'), createdAt: new Date('2024-07-10'), tags: ['Regular'], loyaltyPoints: 270 },
  { id: 'c7', name: 'Liam Johnson', email: 'liam@example.com', phone: '+1 (555) 789-0123', totalVisits: 22, totalSpent: 1980, lastVisit: new Date('2026-02-13'), createdAt: new Date('2024-03-05'), tags: ['VIP'], loyaltyPoints: 410, walletBalance: 100 },
  { id: 'c8', name: 'Isabella Davis', email: 'isabella@example.com', phone: '+1 (555) 890-1234', totalVisits: 9, totalSpent: 720, lastVisit: new Date('2026-02-09'), createdAt: new Date('2025-02-01'), tags: ['New'], loyaltyPoints: 90 },
  { id: 'c9', name: 'Noah Garcia', email: 'noah@example.com', phone: '+1 (555) 901-2345', totalVisits: 30, totalSpent: 3600, lastVisit: new Date('2026-02-07'), createdAt: new Date('2023-09-15'), tags: ['VIP', 'Loyal'], loyaltyPoints: 720 },
  { id: 'c10', name: 'Mia Anderson', email: 'mia@example.com', phone: '+1 (555) 012-3456', totalVisits: 20, totalSpent: 2100, lastVisit: new Date('2026-02-06'), createdAt: new Date('2024-01-20'), tags: ['Regular'], loyaltyPoints: 380 },
  { id: 'c11', name: 'Ethan Taylor', email: 'ethan@example.com', phone: '+1 (555) 111-3333', totalVisits: 6, totalSpent: 480, lastVisit: new Date('2026-02-04'), createdAt: new Date('2025-04-12'), loyaltyPoints: 60 },
  { id: 'c12', name: 'Charlotte Moore', email: 'charlotte@example.com', phone: '+1 (555) 222-4444', totalVisits: 14, totalSpent: 1260, lastVisit: new Date('2026-02-03'), createdAt: new Date('2024-08-30'), tags: ['Regular'], loyaltyPoints: 240 },
  { id: 'c13', name: 'Alexander White', email: 'alex.w@example.com', phone: '+1 (555) 333-5555', totalVisits: 28, totalSpent: 3080, lastVisit: new Date('2026-02-15'), createdAt: new Date('2024-02-14'), tags: ['VIP'], loyaltyPoints: 620 },
  { id: 'c14', name: 'Harper Lee', email: 'harper@example.com', phone: '+1 (555) 444-6666', totalVisits: 11, totalSpent: 935, lastVisit: new Date('2026-02-01'), createdAt: new Date('2024-11-08'), loyaltyPoints: 140 },
  { id: 'c15', name: 'Benjamin Clark', email: 'ben@example.com', phone: '+1 (555) 555-7777', totalVisits: 4, totalSpent: 290, lastVisit: new Date('2026-01-28'), createdAt: new Date('2025-06-20'), tags: ['New'], loyaltyPoints: 35 },
  { id: 'c16', name: 'Amelia Scott', email: 'amelia@example.com', phone: '+1 (555) 666-8888', totalVisits: 16, totalSpent: 1540, lastVisit: new Date('2026-02-16'), createdAt: new Date('2024-05-03'), tags: ['Regular'], loyaltyPoints: 290 },
  { id: 'c17', name: 'Lucas Harris', email: 'lucas@example.com', phone: '+1 (555) 777-9999', totalVisits: 7, totalSpent: 560, lastVisit: new Date('2026-02-02'), createdAt: new Date('2025-03-18'), loyaltyPoints: 70 },
  { id: 'c18', name: 'Evelyn Young', email: 'evelyn@example.com', phone: '+1 (555) 888-0000', totalVisits: 19, totalSpent: 1710, lastVisit: new Date('2026-02-17'), createdAt: new Date('2024-06-28'), tags: ['Regular'], loyaltyPoints: 340 },
  { id: 'c19', name: 'Mason King', email: 'mason@example.com', phone: '+1 (555) 999-1111', totalVisits: 3, totalSpent: 195, lastVisit: new Date('2026-01-20'), createdAt: new Date('2025-08-05'), tags: ['New'], loyaltyPoints: 25 },
  { id: 'c20', name: 'Aria Wright', email: 'aria@example.com', phone: '+1 (555) 100-2222', totalVisits: 25, totalSpent: 2750, lastVisit: new Date('2026-02-12'), createdAt: new Date('2024-01-10'), tags: ['VIP', 'Loyal'], loyaltyPoints: 550 },
  { id: 'c21', name: 'Logan Adams', email: 'logan@example.com', phone: '+1 (555) 200-3333', totalVisits: 10, totalSpent: 850, lastVisit: new Date('2026-02-08'), createdAt: new Date('2024-10-15'), loyaltyPoints: 130 },
  { id: 'c22', name: 'Ella Baker', email: 'ella@example.com', phone: '+1 (555) 300-4444', totalVisits: 13, totalSpent: 1170, lastVisit: new Date('2026-02-10'), createdAt: new Date('2024-07-22'), tags: ['Regular'], loyaltyPoints: 210 },
  { id: 'c23', name: 'Jackson Hill', email: 'jackson@example.com', phone: '+1 (555) 400-5555', totalVisits: 5, totalSpent: 375, lastVisit: new Date('2026-01-30'), createdAt: new Date('2025-05-10'), loyaltyPoints: 50 },
  { id: 'c24', name: 'Chloe Green', email: 'chloe@example.com', phone: '+1 (555) 500-6666', totalVisits: 21, totalSpent: 2310, lastVisit: new Date('2026-02-14'), createdAt: new Date('2024-04-02'), tags: ['VIP'], loyaltyPoints: 460 },
  { id: 'c25', name: 'Aiden Turner', email: 'aiden@example.com', phone: '+1 (555) 600-7777', totalVisits: 2, totalSpent: 130, lastVisit: new Date('2026-01-15'), createdAt: new Date('2025-09-28'), tags: ['New'], loyaltyPoints: 15 },
];

// 18 Services across 6 categories
export const mockServices: Service[] = [
  // Hair (6)
  { id: 's1', name: 'Classic Haircut', description: 'Professional haircut with wash and styling', duration: 45, price: 45, category: 'Hair', color: '#f97316', isActive: true },
  { id: 's2', name: 'Color Treatment', description: 'Full color treatment with premium products', duration: 120, price: 150, category: 'Hair', color: '#8b5cf6', isActive: true, processingTime: 30 },
  { id: 's6', name: 'Beard Trim', description: 'Professional beard shaping and trim', duration: 20, price: 25, category: 'Hair', color: '#f59e0b', isActive: true },
  { id: 's7', name: 'Highlights', description: 'Partial or full highlights', duration: 90, price: 120, category: 'Hair', color: '#f97316', isActive: true, processingTime: 25 },
  { id: 's8', name: 'Blowout & Style', description: 'Professional blowout and styling', duration: 30, price: 35, category: 'Hair', color: '#f97316', isActive: true },
  { id: 's9', name: 'Keratin Treatment', description: 'Smoothing keratin treatment', duration: 150, price: 250, category: 'Hair', color: '#8b5cf6', isActive: true, processingTime: 20 },
  // Wellness (3)
  { id: 's3', name: 'Deep Tissue Massage', description: '60-minute therapeutic massage', duration: 60, price: 95, category: 'Wellness', color: '#10b981', isActive: true },
  { id: 's10', name: 'Swedish Massage', description: 'Relaxing full-body massage', duration: 60, price: 85, category: 'Wellness', color: '#10b981', isActive: true },
  { id: 's11', name: 'Hot Stone Massage', description: 'Heated basalt stone massage', duration: 75, price: 110, category: 'Wellness', color: '#10b981', isActive: true },
  // Nails (3)
  { id: 's4', name: 'Manicure & Pedicure', description: 'Classic nail care combo', duration: 75, price: 65, category: 'Nails', color: '#ec4899', isActive: true },
  { id: 's12', name: 'Gel Manicure', description: 'Long-lasting gel polish manicure', duration: 45, price: 45, category: 'Nails', color: '#ec4899', isActive: true },
  { id: 's13', name: 'Acrylic Full Set', description: 'Full set of acrylic nails', duration: 90, price: 75, category: 'Nails', color: '#ec4899', isActive: true },
  // Skincare (3)
  { id: 's5', name: 'Facial Treatment', description: 'Luxury facial with premium skincare', duration: 60, price: 85, category: 'Skincare', color: '#06b6d4', isActive: true },
  { id: 's14', name: 'Chemical Peel', description: 'Professional chemical peel treatment', duration: 45, price: 95, category: 'Skincare', color: '#06b6d4', isActive: true },
  { id: 's15', name: 'Microdermabrasion', description: 'Exfoliating skin treatment', duration: 40, price: 80, category: 'Skincare', color: '#06b6d4', isActive: true },
  // Brows & Lashes (2)
  { id: 's16', name: 'Eyebrow Wax & Shape', description: 'Professional brow shaping', duration: 15, price: 20, category: 'Brows & Lashes', color: '#a855f7', isActive: true },
  { id: 's17', name: 'Lash Extensions', description: 'Individual lash extensions', duration: 90, price: 150, category: 'Brows & Lashes', color: '#a855f7', isActive: true },
  // Body (1)
  { id: 's18', name: 'Body Scrub & Wrap', description: 'Exfoliating scrub and hydrating wrap', duration: 60, price: 90, category: 'Body', color: '#14b8a6', isActive: true },
];

// 7 Staff
export const mockStaff: Staff[] = [
  {
    id: 'st1', name: 'Alex Morgan', email: 'alex@salonsal.com', phone: '+1 (555) 111-2222',
    role: 'admin', services: ['s1', 's2', 's6', 's7', 's8', 's9'], commission: 40,
    workingHours: { monday: { start: '09:00', end: '18:00' }, tuesday: { start: '09:00', end: '18:00' }, wednesday: { start: '09:00', end: '18:00' }, thursday: { start: '09:00', end: '18:00' }, friday: { start: '09:00', end: '17:00' }, saturday: { start: '10:00', end: '16:00' }, sunday: null },
    color: '#f97316', isActive: true,
  },
  {
    id: 'st2', name: 'Jessica Lee', email: 'jessica@salonsal.com', phone: '+1 (555) 222-3333',
    role: 'staff', services: ['s3', 's5', 's10', 's11', 's18'], commission: 35,
    workingHours: { monday: { start: '10:00', end: '19:00' }, tuesday: { start: '10:00', end: '19:00' }, wednesday: null, thursday: { start: '10:00', end: '19:00' }, friday: { start: '10:00', end: '19:00' }, saturday: { start: '09:00', end: '15:00' }, sunday: null },
    color: '#8b5cf6', isActive: true,
  },
  {
    id: 'st3', name: 'Daniel Park', email: 'daniel@salonsal.com', phone: '+1 (555) 333-4444',
    role: 'staff', services: ['s1', 's4', 's6', 's12', 's13'], commission: 35,
    workingHours: { monday: { start: '08:00', end: '17:00' }, tuesday: { start: '08:00', end: '17:00' }, wednesday: { start: '08:00', end: '17:00' }, thursday: { start: '08:00', end: '17:00' }, friday: { start: '08:00', end: '17:00' }, saturday: null, sunday: null },
    color: '#10b981', isActive: true,
  },
  {
    id: 'st4', name: 'Sarah Kim', email: 'sarah@salonsal.com', phone: '+1 (555) 444-5555',
    role: 'manager', services: ['s2', 's4', 's5', 's7', 's14', 's15'], commission: 38,
    workingHours: { monday: { start: '09:00', end: '18:00' }, tuesday: { start: '09:00', end: '18:00' }, wednesday: { start: '09:00', end: '18:00' }, thursday: { start: '09:00', end: '18:00' }, friday: { start: '09:00', end: '18:00' }, saturday: { start: '10:00', end: '14:00' }, sunday: null },
    color: '#ec4899', isActive: true,
  },
  {
    id: 'st5', name: 'Ryan Cooper', email: 'ryan@salonsal.com', phone: '+1 (555) 555-6666',
    role: 'staff', services: ['s1', 's6', 's8', 's16'], commission: 30,
    workingHours: { monday: null, tuesday: { start: '09:00', end: '18:00' }, wednesday: { start: '09:00', end: '18:00' }, thursday: { start: '09:00', end: '18:00' }, friday: { start: '09:00', end: '18:00' }, saturday: { start: '09:00', end: '16:00' }, sunday: null },
    color: '#06b6d4', isActive: true,
  },
  {
    id: 'st6', name: 'Maya Patel', email: 'maya@salonsal.com', phone: '+1 (555) 666-7777',
    role: 'staff', services: ['s5', 's14', 's15', 's16', 's17'], commission: 35,
    workingHours: { monday: { start: '10:00', end: '18:00' }, tuesday: { start: '10:00', end: '18:00' }, wednesday: { start: '10:00', end: '18:00' }, thursday: null, friday: { start: '10:00', end: '18:00' }, saturday: { start: '09:00', end: '15:00' }, sunday: null },
    color: '#a855f7', isActive: true,
  },
  {
    id: 'st7', name: 'Chris Nguyen', email: 'chris@salonsal.com', phone: '+1 (555) 777-8888',
    role: 'staff', services: ['s3', 's10', 's11', 's18'], commission: 32,
    workingHours: { monday: { start: '08:00', end: '16:00' }, tuesday: { start: '08:00', end: '16:00' }, wednesday: { start: '08:00', end: '16:00' }, thursday: { start: '08:00', end: '16:00' }, friday: { start: '08:00', end: '16:00' }, saturday: null, sunday: null },
    color: '#14b8a6', isActive: true,
  },
];

// Generate appointments spanning 2 weeks
const today = new Date();
today.setHours(0, 0, 0, 0);

function createAppointment(
  id: string,
  clientIndex: number,
  serviceIndex: number,
  staffIndex: number,
  dayOffset: number,
  hour: number,
  minute: number,
  status: Appointment['status'] = 'confirmed'
): Appointment {
  const client = mockClients[clientIndex];
  const service = mockServices[serviceIndex];
  const staff = mockStaff[staffIndex];

  const startTime = new Date(today);
  startTime.setDate(startTime.getDate() + dayOffset);
  startTime.setHours(hour, minute);

  const endTime = new Date(startTime);
  endTime.setMinutes(endTime.getMinutes() + service.duration);

  return {
    id,
    clientId: client.id,
    clientName: client.name,
    clientAvatar: client.avatar,
    serviceId: service.id,
    serviceName: service.name,
    staffId: staff.id,
    staffName: staff.name,
    startTime,
    endTime,
    status,
    price: service.price,
  };
}

export const mockAppointments: Appointment[] = [
  // Today (day 0)
  createAppointment('a1', 0, 0, 0, 0, 9, 0, 'completed'),
  createAppointment('a2', 1, 6, 1, 0, 10, 0, 'completed'),
  createAppointment('a3', 2, 1, 0, 0, 10, 30, 'in-progress'),
  createAppointment('a4', 3, 9, 2, 0, 11, 0, 'confirmed'),
  createAppointment('a5', 4, 12, 1, 0, 13, 0, 'confirmed'),
  createAppointment('a6', 5, 2, 2, 0, 14, 0, 'pending'),
  createAppointment('a7', 6, 0, 0, 0, 15, 0, 'confirmed'),
  createAppointment('a8', 7, 6, 1, 0, 16, 0, 'confirmed'),
  createAppointment('a9', 8, 4, 3, 0, 9, 30, 'completed'),
  createAppointment('a10', 9, 15, 5, 0, 10, 0, 'checked-in'),
  createAppointment('a11', 10, 7, 3, 0, 11, 30, 'confirmed'),
  createAppointment('a12', 11, 10, 4, 0, 13, 0, 'confirmed'),
  // Tomorrow (day 1)
  createAppointment('a13', 12, 0, 0, 1, 9, 0, 'confirmed'),
  createAppointment('a14', 13, 6, 1, 1, 10, 0, 'confirmed'),
  createAppointment('a15', 14, 1, 3, 1, 10, 30, 'confirmed'),
  createAppointment('a16', 15, 9, 2, 1, 11, 0, 'pending'),
  createAppointment('a17', 16, 12, 4, 1, 13, 0, 'confirmed'),
  createAppointment('a18', 17, 0, 0, 1, 14, 0, 'confirmed'),
  createAppointment('a19', 18, 3, 1, 1, 15, 0, 'confirmed'),
  createAppointment('a20', 19, 5, 5, 1, 9, 30, 'confirmed'),
  createAppointment('a21', 20, 14, 3, 1, 14, 30, 'confirmed'),
  // Day 2
  createAppointment('a22', 0, 7, 0, 2, 9, 0, 'confirmed'),
  createAppointment('a23', 1, 0, 2, 2, 10, 0, 'confirmed'),
  createAppointment('a24', 2, 6, 1, 2, 11, 0, 'confirmed'),
  createAppointment('a25', 3, 12, 3, 2, 13, 0, 'pending'),
  createAppointment('a26', 4, 9, 4, 2, 14, 0, 'confirmed'),
  createAppointment('a27', 5, 1, 0, 2, 14, 30, 'confirmed'),
  // Day -1 (yesterday)
  createAppointment('a28', 6, 0, 0, -1, 9, 0, 'completed'),
  createAppointment('a29', 7, 6, 1, -1, 10, 0, 'completed'),
  createAppointment('a30', 8, 9, 2, -1, 11, 0, 'completed'),
  createAppointment('a31', 9, 4, 3, -1, 13, 0, 'completed'),
  createAppointment('a32', 10, 12, 1, -1, 14, 0, 'no-show'),
  createAppointment('a33', 11, 0, 0, -1, 15, 0, 'completed'),
  // Day -2
  createAppointment('a34', 12, 1, 3, -2, 9, 0, 'completed'),
  createAppointment('a35', 13, 6, 1, -2, 10, 0, 'completed'),
  createAppointment('a36', 14, 0, 2, -2, 11, 0, 'completed'),
  createAppointment('a37', 15, 9, 4, -2, 13, 0, 'completed'),
  createAppointment('a38', 16, 3, 0, -2, 14, 0, 'cancelled'),
  // Day 3
  createAppointment('a39', 17, 7, 0, 3, 9, 0, 'confirmed'),
  createAppointment('a40', 18, 12, 2, 3, 10, 0, 'pending'),
  createAppointment('a41', 19, 0, 4, 3, 11, 0, 'confirmed'),
  createAppointment('a42', 20, 6, 1, 3, 13, 0, 'confirmed'),
  createAppointment('a43', 21, 1, 3, 3, 14, 0, 'confirmed'),
  // Day 4
  createAppointment('a44', 22, 0, 0, 4, 9, 0, 'confirmed'),
  createAppointment('a45', 23, 9, 1, 4, 10, 0, 'confirmed'),
  createAppointment('a46', 24, 6, 2, 4, 11, 0, 'pending'),
  createAppointment('a47', 0, 12, 3, 4, 13, 0, 'confirmed'),
  createAppointment('a48', 1, 3, 4, 4, 14, 0, 'confirmed'),
  // Day 5-7
  createAppointment('a49', 2, 0, 0, 5, 9, 0, 'confirmed'),
  createAppointment('a50', 3, 6, 1, 5, 10, 0, 'confirmed'),
  createAppointment('a51', 4, 1, 3, 5, 11, 0, 'confirmed'),
  createAppointment('a52', 5, 9, 2, 5, 13, 0, 'pending'),
  createAppointment('a53', 6, 0, 0, 6, 9, 0, 'confirmed'),
  createAppointment('a54', 7, 12, 4, 6, 10, 0, 'confirmed'),
  createAppointment('a55', 8, 6, 1, 6, 11, 0, 'confirmed'),
  createAppointment('a56', 9, 3, 2, 6, 13, 0, 'confirmed'),
  createAppointment('a57', 10, 0, 0, 7, 9, 0, 'confirmed'),
  createAppointment('a58', 11, 9, 3, 7, 10, 0, 'confirmed'),
  createAppointment('a59', 12, 6, 1, 7, 11, 0, 'confirmed'),
  createAppointment('a60', 13, 1, 0, 7, 13, 0, 'confirmed'),
  // Day -3 to -7
  createAppointment('a61', 0, 0, 0, -3, 9, 0, 'completed'),
  createAppointment('a62', 1, 6, 1, -3, 10, 0, 'completed'),
  createAppointment('a63', 2, 9, 2, -3, 11, 0, 'completed'),
  createAppointment('a64', 3, 0, 0, -4, 9, 0, 'completed'),
  createAppointment('a65', 4, 3, 1, -4, 10, 0, 'completed'),
  createAppointment('a66', 5, 12, 3, -5, 9, 0, 'completed'),
  createAppointment('a67', 6, 6, 2, -5, 10, 0, 'completed'),
  createAppointment('a68', 7, 0, 4, -6, 9, 0, 'completed'),
  createAppointment('a69', 8, 1, 0, -6, 10, 0, 'completed'),
  createAppointment('a70', 9, 9, 1, -7, 9, 0, 'completed'),
];

// Dashboard stats
export const dashboardStats = {
  todayRevenue: 485,
  todayAppointments: 12,
  completedAppointments: 3,
  upcomingAppointments: 7,
  pendingAppointments: 2,
  weeklyRevenue: 3240,
  weeklyGrowth: 12.5,
  monthlyRevenue: 14500,
  monthlyGrowth: 8.3,
  totalClients: 248,
  newClientsThisMonth: 23,
  averageRating: 4.8,
  totalReviews: 156,
};
