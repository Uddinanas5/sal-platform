import { describe, it, expect, vi, beforeEach } from "vitest"

// L-046 — GET /api/v1/staff and /api/v1/staff/[id] stripped PAY for non-admins but
// still returned every colleague's email + phone. Now they strip contact PII too,
// matching getStaff's data-layer model (an admin-scoped caller keeps full data;
// API keys default to role=admin, so only staff-scoped keys/sessions are limited).

const { withV1AuthMock, prismaMock } = vi.hoisted(() => ({
  withV1AuthMock: vi.fn(),
  prismaMock: { staff: { findMany: vi.fn(), findFirst: vi.fn() } },
}))
vi.mock("@/lib/api/auth", () => ({ withV1Auth: withV1AuthMock }))
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

import { GET as listGET } from "@/app/api/v1/staff/route"
import { GET as detailGET } from "@/app/api/v1/staff/[id]/route"

const USER = {
  id: "u1",
  firstName: "Bob",
  lastName: "Barber",
  email: "bob@shop.com",
  phone: "+15551234",
  avatarUrl: null,
  role: "staff",
}
const ROW = {
  id: "s1",
  commissionRate: 45,
  hourlyRate: 20,
  employmentType: "full_time",
  employeeId: "E1",
  hireDate: new Date(0),
  staffServices: [],
  staffSchedules: [],
  timeOff: [],
}

const req = () => new Request("https://x/api/v1/staff")
const params = { params: Promise.resolve({ id: "s1" }) }

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.staff.findMany.mockResolvedValue([{ ...ROW, user: { ...USER } }])
  prismaMock.staff.findFirst.mockResolvedValue({ ...ROW, user: { ...USER } })
})

describe("GET /api/v1/staff (list) — strips pay + contact PII for non-admins (L-046)", () => {
  it("a staff-role caller gets NO email/phone/commission", async () => {
    withV1AuthMock.mockResolvedValue({ userId: "u9", businessId: "b1", role: "staff" })
    const { data } = await (await listGET(req())).json()
    expect(data[0].user.email).toBeUndefined()
    expect(data[0].user.phone).toBeUndefined()
    expect(data[0].commissionRate).toBeUndefined()
    // Non-sensitive identity fields still present.
    expect(data[0].user.firstName).toBe("Bob")
    expect(data[0].user.role).toBe("staff")
  })

  it("an admin caller gets full email/phone/commission", async () => {
    withV1AuthMock.mockResolvedValue({ userId: "u1", businessId: "b1", role: "admin" })
    const { data } = await (await listGET(req())).json()
    expect(data[0].user.email).toBe("bob@shop.com")
    expect(data[0].user.phone).toBe("+15551234")
    expect(data[0].commissionRate).toBe(45)
  })
})

describe("GET /api/v1/staff/[id] (detail) — strips pay + contact PII for non-admins (L-046)", () => {
  it("a staff-role caller gets NO email/phone/pay", async () => {
    withV1AuthMock.mockResolvedValue({ userId: "u9", businessId: "b1", role: "staff" })
    const { data } = await (await detailGET(req(), params)).json()
    expect(data.user.email).toBeUndefined()
    expect(data.user.phone).toBeUndefined()
    expect(data.commissionRate).toBeUndefined()
    expect(data.user.firstName).toBe("Bob")
  })

  it("an admin caller gets full email/phone/pay", async () => {
    withV1AuthMock.mockResolvedValue({ userId: "u1", businessId: "b1", role: "admin" })
    const { data } = await (await detailGET(req(), params)).json()
    expect(data.user.email).toBe("bob@shop.com")
    expect(data.commissionRate).toBe(45)
  })
})
