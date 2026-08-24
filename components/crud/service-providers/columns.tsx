"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DataTableColumnHeader } from "../DataTableColumnHeader"
import { ServiceProvider } from "./schema"

export const columns: ColumnDef<ServiceProvider>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Provider" />
    ),
    cell: ({ row }) => {
      const provider = row.original
      return (
        <div className="flex items-center space-x-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={provider.image_url || ""} alt={provider.name} />
            <AvatarFallback>
              {provider.name.split(' ').map(n => n[0]).join('').toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="font-medium">{provider.name}</div>
        </div>
      )
    },
  },
  {
    accessorKey: "service_category",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Category" />
    ),
    accessorFn: (row: any) => {
      if (Array.isArray(row.service_provider_categories) && row.service_provider_categories.length > 0) {
        return row.service_provider_categories
          .map((spc: any) => spc.service_category?.name)
          .filter(Boolean)
          .join(", ")
      }
      return row.service_category?.name || "Uncategorized"
    },
    cell: ({ row }: any) => {
      const provider = row.original
      const linkedCategories = Array.isArray(provider.service_provider_categories)
        ? provider.service_provider_categories.map((spc: any) => spc.service_category?.name).filter(Boolean)
        : []

      const categoryNames = linkedCategories.length > 0 
        ? linkedCategories 
        : (provider.service_category?.name ? [provider.service_category.name] : [])

      if (categoryNames.length === 0) {
        return <span className="text-muted-foreground text-xs">Uncategorized</span>
      }

      return (
        <div className="flex flex-wrap gap-1 max-w-[220px]">
          {categoryNames.map((catName: string, idx: number) => (
            <Badge key={idx} variant="outline" className="text-xs font-normal bg-slate-50 border-slate-300">
              {catName}
            </Badge>
          ))}
        </div>
      )
    },
  },
  {
    accessorKey: "location",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Location" />
    ),
    accessorFn: (row) => row.location?.address || "",
    filterFn: (row, id, value) => {
      const address = row.original.location?.address || ""
      return address.toLowerCase().includes(String(value).toLowerCase())
    },
    cell: ({ row }) => {
      const location = row.original.location
      return (
        <div className="max-w-[200px] truncate">
          {location?.address || "No location"}
        </div>
      )
    },
  },
  {
    accessorKey: "phone",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Phone" />
    ),
    cell: ({ row }) => {
      const phone = row.getValue("phone") as string
      return phone || "No phone"
    },
  },

  {
    accessorKey: "is_active",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const isActive = row.getValue("is_active") as boolean
      return (
        <Badge variant={isActive ? "default" : "secondary"}>
          {isActive ? "Active" : "Inactive"}
        </Badge>
      )
    },
  },
]
