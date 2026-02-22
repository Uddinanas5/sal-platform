"use client"

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { ChevronLeft, ChevronRight, SlidersHorizontal, Check, X, SearchX } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface BulkAction<TData> {
  label: string
  icon?: React.ReactNode
  variant?: "default" | "destructive" | "outline"
  onClick: (selectedRows: TData[]) => void
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  searchKey?: string
  searchValue?: string
  pageSize?: number
  className?: string
  showColumnToggle?: boolean
  enableRowSelection?: boolean
  bulkActions?: BulkAction<TData>[]
  emptyMessage?: string
  emptyDescription?: string
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchValue,
  pageSize = 10,
  className,
  showColumnToggle = false,
  enableRowSelection = false,
  bulkActions = [],
  emptyMessage = "No results found",
  emptyDescription = "Try adjusting your search or filters.",
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})

  React.useEffect(() => {
    if (searchKey && searchValue !== undefined) {
      setColumnFilters([{ id: searchKey, value: searchValue }])
    }
  }, [searchKey, searchValue])

  // Prepend selection checkbox column when row selection is enabled
  const allColumns = React.useMemo(() => {
    if (!enableRowSelection) return columns
    const selectColumn: ColumnDef<TData, TValue> = {
      id: "select",
      header: ({ table: t }) => (
        <Checkbox
          checked={t.getIsAllPageRowsSelected() || (t.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(value) => t.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          className="translate-y-[2px]"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    }
    return [selectColumn, ...columns]
  }, [columns, enableRowSelection])

  const table = useReactTable({
    data,
    columns: allColumns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: { sorting, columnFilters, columnVisibility, rowSelection },
    initialState: { pagination: { pageSize } },
  })

  const selectedCount = table.getFilteredSelectedRowModel().rows.length
  const selectedRows = table.getFilteredSelectedRowModel().rows.map((r) => r.original)

  return (
    <div className={cn("space-y-4", className)}>
      {/* Bulk action bar */}
      {enableRowSelection && selectedCount > 0 && bulkActions.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg bg-sal-50 border border-sal-200 px-4 py-2.5 animate-in fade-in slide-in-from-top-2">
          <span className="text-sm font-medium text-sal-700">
            {selectedCount} selected
          </span>
          <div className="h-4 w-px bg-sal-200" />
          {bulkActions.map((action) => (
            <Button
              key={action.label}
              variant={action.variant === "destructive" ? "destructive" : "outline"}
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => action.onClick(selectedRows)}
            >
              {action.icon}
              {action.label}
            </Button>
          ))}
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => table.toggleAllRowsSelected(false)}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Clear
          </Button>
        </div>
      )}

      {showColumnToggle && (
        <div className="flex justify-end">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Columns
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-48 p-2">
              <p className="text-xs font-medium text-muted-foreground px-2 pb-2">Toggle columns</p>
              {table
                .getAllColumns()
                .filter((col) => col.getCanHide())
                .map((col) => (
                  <button
                    key={col.id}
                    onClick={() => col.toggleVisibility(!col.getIsVisible())}
                    className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm hover:bg-cream-100 transition-colors"
                  >
                    <span className={cn(
                      "flex h-4 w-4 items-center justify-center rounded border border-cream-300",
                      col.getIsVisible() && "bg-sal-500 border-sal-500"
                    )}>
                      {col.getIsVisible() && <Check className="h-3 w-3 text-white" />}
                    </span>
                    <span className="capitalize">{col.id.replace(/([A-Z])/g, " $1").trim()}</span>
                  </button>
                ))}
            </PopoverContent>
          </Popover>
        </div>
      )}
      <div className="rounded-md border">
        <table className="w-full caption-bottom text-sm">
          <thead className="[&_tr]:border-b">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b transition-colors hover:bg-muted/50">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="p-4 align-middle [&:has([role=checkbox])]:pr-0">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={allColumns.length} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center py-8">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                      <SearchX className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-foreground">{emptyMessage}</p>
                    <p className="text-xs text-muted-foreground mt-1">{emptyDescription}</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between px-2">
        <div className="text-sm text-muted-foreground">
          {enableRowSelection
            ? `${table.getFilteredSelectedRowModel().rows.length} of ${table.getFilteredRowModel().rows.length} row(s) selected.`
            : `${table.getFilteredRowModel().rows.length} row(s)`}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
