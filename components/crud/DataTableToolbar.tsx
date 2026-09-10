"use client"

import { Table } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DataTableViewOptions } from "@/components/tabel/DataTableViewOptions"
import { PlusCircle, X, Filter } from "lucide-react"

interface DataTableToolbarProps<TData> {
  table: Table<TData>
  filterKey: string
  placeholder?: string
  secondaryFilterKey?: string
  secondaryPlaceholder?: string
  categoryFilterKey?: string
  categoryPlaceholder?: string
  categoryOptions?: { label: string; value: string }[]
  onCategoryChange?: (value: string) => void
  onAdd?: () => void
}

export function DataTableToolbar<TData>({
  table,
  filterKey,
  placeholder = "Filter...",
  secondaryFilterKey,
  secondaryPlaceholder = "Filter by location...",
  categoryFilterKey,
  categoryPlaceholder = "All Categories",
  categoryOptions,
  onCategoryChange,
  onAdd
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2 flex-wrap gap-y-2">
        <Input
          placeholder={placeholder}
          value={(table.getColumn(filterKey)?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn(filterKey)?.setFilterValue(event.target.value)
          }
          className="h-8 w-[150px] lg:w-[220px]"
        />
        {categoryFilterKey && table.getColumn(categoryFilterKey) && categoryOptions && (
          <Select
            value={(table.getColumn(categoryFilterKey)?.getFilterValue() as string) || "all"}
            onValueChange={(val) => {
              const filterVal = val === "all" ? "" : val
              table.getColumn(categoryFilterKey)?.setFilterValue(filterVal)
              if (onCategoryChange) {
                onCategoryChange(filterVal)
              }
            }}
          >
            <SelectTrigger className="h-8 w-[170px] lg:w-[220px] bg-background">
              <Filter className="mr-2 h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <SelectValue placeholder={categoryPlaceholder} />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value="all">All Categories / Groups</SelectItem>
              {categoryOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {secondaryFilterKey && table.getColumn(secondaryFilterKey) && (
          <Input
            placeholder={secondaryPlaceholder}
            value={(table.getColumn(secondaryFilterKey)?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              table.getColumn(secondaryFilterKey)?.setFilterValue(event.target.value)
            }
            className="h-8 w-[150px] lg:w-[200px]"
          />
        )}
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => {
              table.resetColumnFilters()
              if (onCategoryChange) {
                onCategoryChange("")
              }
            }}
            className="h-8 px-2 lg:px-3"
          >
            Reset
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="flex items-center space-x-2">
        <DataTableViewOptions table={table} />
        {onAdd && (
          <Button 
            className="h-8 px-2 lg:px-3" 
            onClick={onAdd}
            variant="default"
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Add New
          </Button>
        )}
      </div>
    </div>
  )
}
