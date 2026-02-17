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
  status: 'confirmed' | 'pending' | 'completed' | 'cancelled' | 'no-show';
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
}

// Sample data
export const mockClients: Client[] = [
  {
    id: 'c1',
    name: 'Emma Thompson',
    email: 'emma@example.com',
    phone: '+1 (555) 123-4567',
    avatar: '/avatars/emma.jpg',
    totalVisits: 24,
    totalSpent: 2450,
    lastVisit: new Date('2026-02-10'),
    createdAt: new Date('2024-06-15'),
    tags: ['VIP', 'Regular'],
  },
  {
    id: 'c2',
    name: 'Michael Chen',
    email: 'michael@example.com',
    phone: '+1 (555) 234-5678',
    totalVisits: 12,
    totalSpent: 980,
    lastVisit: new Date('2026-02-08'),
    createdAt: new Date('2024-09-20'),
    tags: ['New'],
  },
  {
    id: 'c3',
    name: 'Sofia Rodriguez',
    email: 'sofia@example.com',
    phone: '+1 (555) 345-6789',
    totalVisits: 36,
    totalSpent: 4200,
    lastVisit: new Date('2026-02-12'),
    createdAt: new Date('2023-11-05'),
    tags: ['VIP', 'Loyal'],
  },
  {
    id: 'c4',
    name: 'James Wilson',
    email: 'james@example.com',
    phone: '+1 (555) 456-7890',
    totalVisits: 8,
    totalSpent: 640,
    lastVisit: new Date('2026-02-05'),
    createdAt: new Date('2025-01-10'),
  },
  {
    id: 'c5',
    name: 'Olivia Brown',
    email: 'olivia@example.com',
    phone: '+1 (555) 567-8901',
    totalVisits: 18,
    totalSpent: 1800,
    lastVisit: new Date('2026-02-11'),
    createdAt: new Date('2024-04-22'),
    tags: ['Regular'],
  },
];

export const mockServices: Service[] = [
  {
    id: 's1',
    name: 'Classic Haircut',
    description: 'Professional haircut with wash and styling',
    duration: 45,
    price: 45,
    category: 'Hair',
    color: '#f97316',
    isActive: true,
  },
  {
    id: 's2',
    name: 'Color Treatment',
    description: 'Full color treatment with premium products',
    duration: 120,
    price: 150,
    category: 'Hair',
    color: '#8b5cf6',
    isActive: true,
  },
  {
    id: 's3',
    name: 'Deep Tissue Massage',
    description: '60-minute therapeutic massage',
    duration: 60,
    price: 95,
    category: 'Wellness',
    color: '#10b981',
    isActive: true,
  },
  {
    id: 's4',
    name: 'Manicure & Pedicure',
    description: 'Classic nail care combo',
    duration: 75,
    price: 65,
    category: 'Nails',
    color: '#ec4899',
    isActive: true,
  },
  {
    id: 's5',
    name: 'Facial Treatment',
    description: 'Luxury facial with premium skincare',
    duration: 60,
    price: 85,
    category: 'Skincare',
    color: '#06b6d4',
    isActive: true,
  },
  {
    id: 's6',
    name: 'Beard Trim',
    description: 'Professional beard shaping and trim',
    duration: 20,
    price: 25,
    category: 'Hair',
    color: '#f59e0b',
    isActive: true,
  },
];

export const mockStaff: Staff[] = [
  {
    id: 'st1',
    name: 'Alex Morgan',
    email: 'alex@salonsal.com',
    phone: '+1 (555) 111-2222',
    role: 'admin',
    services: ['s1', 's2', 's6'],
    workingHours: {
      monday: { start: '09:00', end: '18:00' },
      tuesday: { start: '09:00', end: '18:00' },
      wednesday: { start: '09:00', end: '18:00' },
      thursday: { start: '09:00', end: '18:00' },
      friday: { start: '09:00', end: '17:00' },
      saturday: { start: '10:00', end: '16:00' },
      sunday: null,
    },
    color: '#f97316',
    isActive: true,
  },
  {
    id: 'st2',
    name: 'Jessica Lee',
    email: 'jessica@salonsal.com',
    phone: '+1 (555) 222-3333',
    role: 'staff',
    services: ['s3', 's5'],
    workingHours: {
      monday: { start: '10:00', end: '19:00' },
      tuesday: { start: '10:00', end: '19:00' },
      wednesday: null,
      thursday: { start: '10:00', end: '19:00' },
      friday: { start: '10:00', end: '19:00' },
      saturday: { start: '09:00', end: '15:00' },
      sunday: null,
    },
    color: '#8b5cf6',
    isActive: true,
  },
  {
    id: 'st3',
    name: 'Daniel Park',
    email: 'daniel@salonsal.com',
    phone: '+1 (555) 333-4444',
    role: 'staff',
    services: ['s1', 's4', 's6'],
    workingHours: {
      monday: { start: '08:00', end: '17:00' },
      tuesday: { start: '08:00', end: '17:00' },
      wednesday: { start: '08:00', end: '17:00' },
      thursday: { start: '08:00', end: '17:00' },
      friday: { start: '08:00', end: '17:00' },
      saturday: null,
      sunday: null,
    },
    color: '#10b981',
    isActive: true,
  },
  {
    id: 'st4',
    name: 'Sarah Kim',
    email: 'sarah@salonsal.com',
    phone: '+1 (555) 444-5555',
    role: 'manager',
    services: ['s2', 's4', 's5'],
    workingHours: {
      monday: { start: '09:00', end: '18:00' },
      tuesday: { start: '09:00', end: '18:00' },
      wednesday: { start: '09:00', end: '18:00' },
      thursday: { start: '09:00', end: '18:00' },
      friday: { start: '09:00', end: '18:00' },
      saturday: { start: '10:00', end: '14:00' },
      sunday: null,
    },
    color: '#ec4899',
    isActive: true,
  },
];

// Generate today's appointments
const today = new Date();
today.setHours(0, 0, 0, 0);

function createAppointment(
  id: string,
  clientIndex: number,
  serviceIndex: number,
  staffIndex: number,
  hour: number,
  minute: number,
  status: Appointment['status'] = 'confirmed'
): Appointment {
  const client = mockClients[clientIndex];
  const service = mockServices[serviceIndex];
  const staff = mockStaff[staffIndex];
  
  const startTime = new Date(today);
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
  createAppointment('a1', 0, 0, 0, 9, 0, 'completed'),
  createAppointment('a2', 1, 2, 1, 10, 0, 'completed'),
  createAppointment('a3', 2, 1, 0, 10, 30, 'confirmed'),
  createAppointment('a4', 3, 3, 2, 11, 0, 'confirmed'),
  createAppointment('a5', 4, 4, 1, 13, 0, 'confirmed'),
  createAppointment('a6', 0, 5, 2, 14, 0, 'pending'),
  createAppointment('a7', 1, 0, 0, 15, 0, 'confirmed'),
  createAppointment('a8', 2, 2, 1, 16, 0, 'confirmed'),
];

// Dashboard stats
export const dashboardStats = {
  todayRevenue: 485,
  todayAppointments: 8,
  completedAppointments: 2,
  upcomingAppointments: 5,
  pendingAppointments: 1,
  weeklyRevenue: 3240,
  weeklyGrowth: 12.5,
  monthlyRevenue: 14500,
  monthlyGrowth: 8.3,
  totalClients: 248,
  newClientsThisMonth: 23,
  averageRating: 4.8,
  totalReviews: 156,
};
