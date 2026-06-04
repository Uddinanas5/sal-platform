"use client"

import React, { useCallback, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { FileText, CheckCircle2, AlertTriangle, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { importClients, type ImportClientRow } from "@/lib/actions/clients"

// ---------------------------------------------------------------------------
// Inline CSV parser (no external dependency). Handles:
//   - quoted fields ("a,b" stays one field)
//   - embedded commas and newlines inside quotes
//   - escaped quotes ("" -> ")
//   - CRLF, CR, and LF line endings
//   - a trailing newline at EOF
// Returns a 2D array of string cells (one inner array per record).
// ---------------------------------------------------------------------------
export function parseCsv(input: string): string[][] {
  const rows: string[][] = []
  let field = ""
  let row: string[] = []
  let inQuotes = false
  let i = 0
  const n = input.length

  const pushField = () => {
    row.push(field)
    field = ""
  }
  const pushRow = () => {
    pushField()
    rows.push(row)
    row = []
  }

  while (i < n) {
    const ch = input[i]

    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += ch
      i++
      continue
    }

    if (ch === '"') {
      inQuotes = true
      i++
      continue
    }
    if (ch === ",") {
      pushField()
      i++
      continue
    }
    if (ch === "\r") {
      // Treat \r and \r\n as a single line break.
      pushRow()
      if (input[i + 1] === "\n") i += 2
      else i++
      continue
    }
    if (ch === "\n") {
      pushRow()
      i++
      continue
    }
    field += ch
    i++
  }

  // Flush the final field/row unless the input ended on a clean line break
  // (in which case field === "" and row is empty).
  if (field !== "" || row.length > 0) {
    pushRow()
  }

  // Drop rows that are entirely empty (e.g. a stray blank line).
  return rows.filter((r) => r.some((c) => c.trim() !== ""))
}

type HeaderMap = {
  name: number
  firstName: number
  lastName: number
  phone: number
  email: number
  notes: number
}

const HEADER_ALIASES: Record<keyof HeaderMap, string[]> = {
  name: ["name", "full name", "client name", "fullname", "client"],
  firstName: ["first name", "firstname", "first", "given name"],
  lastName: ["last name", "lastname", "last", "surname", "family name"],
  phone: ["phone", "mobile", "cell", "telephone", "phone number", "tel", "contact"],
  email: ["email", "e-mail", "email address", "mail"],
  notes: ["notes", "note", "comment", "comments", "remarks"],
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ")
}

// Inspect the first record. If it looks like a header row (matches any known
// alias), return a column map. Otherwise return null (treat data as headerless).
function detectHeaders(headerRow: string[]): HeaderMap | null {
  const map: HeaderMap = {
    name: -1,
    firstName: -1,
    lastName: -1,
    phone: -1,
    email: -1,
    notes: -1,
  }
  let matched = false
  headerRow.forEach((cell, idx) => {
    const norm = normalizeHeader(cell)
    for (const key of Object.keys(HEADER_ALIASES) as (keyof HeaderMap)[]) {
      if (map[key] === -1 && HEADER_ALIASES[key].includes(norm)) {
        map[key] = idx
        matched = true
        break
      }
    }
  })
  return matched ? map : null
}

// Convert parsed CSV cells into importable rows using the detected header map.
// When no headers are detected we fall back to positional columns:
//   name, phone, email, notes
function rowsFromCsv(records: string[][]): {
  rows: ImportClientRow[]
  headerDetected: boolean
} {
  if (records.length === 0) return { rows: [], headerDetected: false }

  const headerMap = detectHeaders(records[0])
  const dataRows = headerMap ? records.slice(1) : records

  const get = (cells: string[], idx: number) =>
    idx >= 0 && idx < cells.length ? cells[idx].trim() : ""

  const rows: ImportClientRow[] = dataRows.map((cells) => {
    if (headerMap) {
      return {
        name: get(cells, headerMap.name) || undefined,
        firstName: get(cells, headerMap.firstName) || undefined,
        lastName: get(cells, headerMap.lastName) || undefined,
        phone: get(cells, headerMap.phone) || undefined,
        email: get(cells, headerMap.email) || undefined,
        notes: get(cells, headerMap.notes) || undefined,
      }
    }
    // Headerless positional fallback: name, phone, email, notes
    return {
      name: get(cells, 0) || undefined,
      phone: get(cells, 1) || undefined,
      email: get(cells, 2) || undefined,
      notes: get(cells, 3) || undefined,
    }
  })

  return { rows, headerDetected: headerMap !== null }
}

function displayName(r: ImportClientRow): string {
  if (r.firstName || r.lastName) {
    return [r.firstName, r.lastName].filter(Boolean).join(" ")
  }
  return r.name || "—"
}

interface ImportClientsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ImportClientsDialog({ open, onOpenChange }: ImportClientsDialogProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [rawText, setRawText] = useState("")
  const [fileName, setFileName] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)

  const parsed = useMemo(() => {
    if (!rawText.trim()) return { rows: [] as ImportClientRow[], headerDetected: false }
    const records = parseCsv(rawText)
    return rowsFromCsv(records)
  }, [rawText])

  // Only count rows that have something importable for the preview total.
  const validRows = useMemo(
    () =>
      parsed.rows.filter(
        (r) => (r.firstName || r.lastName || r.name || r.phone || r.email)
      ),
    [parsed.rows]
  )

  const reset = useCallback(() => {
    setRawText("")
    setFileName(null)
    setIsImporting(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }, [])

  const handleFile = useCallback((file: File) => {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      setRawText(typeof reader.result === "string" ? reader.result : "")
    }
    reader.onerror = () => toast.error("Could not read that file")
    reader.readAsText(file)
  }, [])

  const handleImport = useCallback(async () => {
    if (validRows.length === 0) {
      toast.error("No valid rows to import")
      return
    }
    setIsImporting(true)
    try {
      const res = await importClients(parsed.rows)
      if (!res.success) {
        toast.error(res.error || "Import failed")
        return
      }
      const { created, updated, skipped, errors } = res.data
      const parts: string[] = []
      if (created) parts.push(`${created} added`)
      if (updated) parts.push(`${updated} updated`)
      if (skipped) parts.push(`${skipped} skipped`)
      const summary = parts.length ? parts.join(", ") : "No changes"
      if (errors.length > 0) {
        toast.warning(`Imported: ${summary}. ${errors.length} row(s) had errors.`)
      } else {
        toast.success(`Imported ${created + updated} client(s) (${summary})`)
      }
      onOpenChange(false)
      reset()
      router.refresh()
    } finally {
      setIsImporting(false)
    }
  }, [validRows.length, parsed.rows, onOpenChange, reset, router])

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) reset()
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading">Import Clients</DialogTitle>
          <DialogDescription>
            Paste your client list or upload a .csv file. We auto-detect columns
            like name, phone, and email. Existing clients (matched by phone or
            email) are updated, not duplicated.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
            }}
          />

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileText className="w-4 h-4 mr-2" />
              Upload .csv
            </Button>
            {fileName && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                {fileName}
                <button
                  type="button"
                  aria-label="Clear file"
                  onClick={reset}
                  className="hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            )}
            <span className="text-xs text-muted-foreground ml-auto">or paste below</span>
          </div>

          <Textarea
            placeholder={
              "name, phone, email, notes\nJohn Doe, +1 (555) 123-4567, john@example.com, walk-in"
            }
            value={rawText}
            onChange={(e) => {
              setRawText(e.target.value)
              if (fileName) setFileName(null)
            }}
            className="min-h-[140px] font-mono text-xs"
          />

          {/* Preview */}
          {validRows.length > 0 && (
            <div className="rounded-lg border border-cream-200 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-cream-100 text-sm">
                <span className="font-medium">
                  {validRows.length} client{validRows.length === 1 ? "" : "s"} ready to
                  import
                </span>
                <span className="text-xs text-muted-foreground">
                  {parsed.headerDetected
                    ? "Headers detected"
                    : "No headers — using name, phone, email, notes order"}
                </span>
              </div>
              <div className="max-h-48 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b border-cream-200 text-left text-xs text-muted-foreground">
                      <th className="py-1.5 px-3 font-medium">Name</th>
                      <th className="py-1.5 px-3 font-medium">Phone</th>
                      <th className="py-1.5 px-3 font-medium">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validRows.slice(0, 50).map((r, idx) => (
                      <tr key={idx} className="border-b border-cream-200 last:border-0">
                        <td className="py-1.5 px-3">{displayName(r)}</td>
                        <td className="py-1.5 px-3 text-muted-foreground">
                          {r.phone || "—"}
                        </td>
                        <td className="py-1.5 px-3 text-muted-foreground">
                          {r.email || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {validRows.length > 50 && (
                  <p className="py-1.5 px-3 text-xs text-muted-foreground">
                    + {validRows.length - 50} more not shown
                  </p>
                )}
              </div>
            </div>
          )}

          {rawText.trim() && validRows.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-amber-600">
              <AlertTriangle className="w-4 h-4" />
              No importable rows found. Make sure each row has a name, phone, or email.
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false)
              reset()
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={isImporting || validRows.length === 0}>
            {isImporting ? (
              "Importing..."
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Import {validRows.length > 0 ? validRows.length : ""}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
