"use client"

import React, { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { UserCircle, ChevronDown } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn, getInitials } from "@/lib/utils"

interface ClientItem {
  id: string
  name: string
  email: string
  phone: string
  avatar?: string
  tags?: string[]
}

interface ClientSelectorProps {
  clients: ClientItem[]
  clientId: string | null
  clientName: string | null
  onSelectClient: (clientId: string, clientName: string) => void
  onClearClient: () => void
}

export function ClientSelector({
  clients,
  clientId,
  clientName,
  onSelectClient,
  onClearClient,
}: ClientSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filteredClients = clients.filter(
    (client) =>
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.phone.includes(searchQuery)
  )

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  if (clientId && clientName) {
    const selectedClient = clients.find((c) => c.id === clientId)
    return (
      <div className="flex items-center gap-3 rounded-lg border bg-sal-50/50 p-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={selectedClient?.avatar} />
          <AvatarFallback className="bg-sal-100 text-sal-700 text-sm font-medium">
            {getInitials(clientName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{clientName}</p>
          {selectedClient && (
            <p className="truncate text-xs text-muted-foreground">
              {selectedClient.email}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => {
            onClearClient()
            setSearchQuery("")
          }}
        >
          Change
        </Button>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border bg-background px-3 py-2 cursor-pointer transition-colors",
          isOpen && "ring-2 ring-sal-500 border-sal-500"
        )}
        onClick={() => setIsOpen(true)}
      >
        <UserCircle className="h-4 w-4 text-muted-foreground" />
        {isOpen ? (
          <Input
            ref={inputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search clients..."
            className="h-auto border-0 p-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        ) : (
          <span className="flex-1 text-sm text-muted-foreground">
            Select a client...
          </span>
        )}
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border bg-background shadow-lg"
          >
            {filteredClients.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No clients found
              </div>
            ) : (
              <div className="p-1">
                {filteredClients.map((client) => (
                  <button
                    key={client.id}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-accent"
                    onClick={() => {
                      onSelectClient(client.id, client.name)
                      setIsOpen(false)
                      setSearchQuery("")
                    }}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={client.avatar} />
                      <AvatarFallback className="text-xs">
                        {getInitials(client.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {client.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {client.email}
                      </p>
                    </div>
                    {client.tags && client.tags.includes("VIP") && (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        VIP
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
