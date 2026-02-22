"use client"

import React, { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Users,
  Scissors,
  UserCircle,
  LayoutDashboard,
  Calendar,
  Settings,
  BarChart3,
  ShoppingCart,
  Package,
  Megaphone,
  Star,
  CreditCard,
  CalendarPlus,
  UserPlus,
  DollarSign,
  Keyboard,
} from "lucide-react"
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { formatCurrency } from "@/lib/utils"

interface SearchClient {
  id: string
  name: string
  email: string
}

interface SearchService {
  id: string
  name: string
  price: number
  category: string
}

interface SearchStaff {
  id: string
  name: string
  role: string
}

interface SearchData {
  clients: SearchClient[]
  services: SearchService[]
  staff: SearchStaff[]
}

const pages = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Calendar", href: "/calendar", icon: Calendar },
  { name: "Clients", href: "/clients", icon: Users },
  { name: "Services", href: "/services", icon: Scissors },
  { name: "Staff", href: "/staff", icon: UserCircle },
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "Reports", href: "/reports", icon: BarChart3 },
  { name: "Checkout", href: "/checkout", icon: ShoppingCart },
  { name: "Inventory", href: "/inventory", icon: Package },
  { name: "Marketing", href: "/marketing", icon: Megaphone },
  { name: "Reviews", href: "/reviews", icon: Star },
  { name: "Memberships", href: "/memberships", icon: CreditCard },
  { name: "Booking", href: "/booking", icon: CalendarPlus },
]

const actions = [
  { name: "New Appointment", href: "/calendar", icon: CalendarPlus },
  { name: "New Client", href: "/clients", icon: UserPlus },
  { name: "Quick Checkout", href: "/checkout", icon: DollarSign },
]

export function CommandMenu() {
  const [open, setOpen] = useState(false)
  const [searchData, setSearchData] = useState<SearchData | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  // Fetch search data when command menu opens
  useEffect(() => {
    if (!open || searchData) return

    let cancelled = false
    setLoading(true)

    async function fetchSearchData() {
      try {
        const res = await fetch("/api/search")
        if (!cancelled && res.ok) {
          const data = await res.json()
          setSearchData(data)
        }
      } catch {
        // Silently fail - search groups will just be empty
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchSearchData()
    return () => { cancelled = true }
  }, [open, searchData])

  const runCommand = useCallback(
    (command: () => void) => {
      setOpen(false)
      command()
    },
    []
  )

  const clients = searchData?.clients ?? []
  const services = searchData?.services ?? []
  const staff = searchData?.staff ?? []

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>
          {loading ? "Loading..." : "No results found."}
        </CommandEmpty>

        {clients.length > 0 && (
          <CommandGroup heading="Clients">
            {clients.map((client) => (
              <CommandItem
                key={client.id}
                value={`${client.name} ${client.email}`}
                onSelect={() =>
                  runCommand(() => router.push(`/clients/${client.id}`))
                }
              >
                <Users className="mr-2 h-4 w-4 text-muted-foreground/70" />
                <div className="flex flex-col">
                  <span>{client.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {client.email}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {services.length > 0 && (
          <CommandGroup heading="Services">
            {services.map((service) => (
              <CommandItem
                key={service.id}
                value={`${service.name} ${service.category}`}
                onSelect={() =>
                  runCommand(() => router.push("/services"))
                }
              >
                <Scissors className="mr-2 h-4 w-4 text-muted-foreground/70" />
                <div className="flex flex-col">
                  <span>{service.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatCurrency(service.price)} &middot; {service.category}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {staff.length > 0 && (
          <CommandGroup heading="Staff">
            {staff.map((member) => (
              <CommandItem
                key={member.id}
                value={`${member.name} ${member.role}`}
                onSelect={() =>
                  runCommand(() => router.push(`/staff/${member.id}`))
                }
              >
                <UserCircle className="mr-2 h-4 w-4 text-muted-foreground/70" />
                <div className="flex flex-col">
                  <span>{member.name}</span>
                  <span className="text-xs text-muted-foreground capitalize">
                    {member.role}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandGroup heading="Pages">
          {pages.map((page) => (
            <CommandItem
              key={page.href}
              value={page.name}
              onSelect={() =>
                runCommand(() => router.push(page.href))
              }
            >
              <page.icon className="mr-2 h-4 w-4 text-muted-foreground/70" />
              <span>{page.name}</span>
              {page.name === "Dashboard" && (
                <CommandShortcut>⌘D</CommandShortcut>
              )}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="Actions">
          {actions.map((action) => (
            <CommandItem
              key={action.name}
              value={action.name}
              onSelect={() =>
                runCommand(() => router.push(action.href))
              }
            >
              <action.icon className="mr-2 h-4 w-4 text-muted-foreground/70" />
              <span>{action.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Keyboard Shortcuts">
          <CommandItem value="shortcut search" onSelect={() => setOpen(false)}>
            <Keyboard className="mr-2 h-4 w-4 text-muted-foreground/70" />
            <span>Search</span>
            <CommandShortcut>⌘K</CommandShortcut>
          </CommandItem>
          <CommandItem value="shortcut quick search" onSelect={() => setOpen(false)}>
            <Keyboard className="mr-2 h-4 w-4 text-muted-foreground/70" />
            <span>Quick Search</span>
            <CommandShortcut>/</CommandShortcut>
          </CommandItem>
          <CommandItem
            value="shortcut new booking"
            onSelect={() => runCommand(() => router.push("/calendar"))}
          >
            <Keyboard className="mr-2 h-4 w-4 text-muted-foreground/70" />
            <span>New Booking (on Calendar)</span>
            <CommandShortcut>N</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
