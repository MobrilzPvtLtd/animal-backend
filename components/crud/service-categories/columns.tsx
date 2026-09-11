"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { DataTableColumnHeader } from "../DataTableColumnHeader"
import { ServiceCategory } from "./schema"

export const columns: ColumnDef<ServiceCategory>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => {
      const category = row.original
      return (
        <div className="flex items-center space-x-3">
          {category.image_url ? (
            <img
              src={category.image_url}
              alt={category.name}
              className="w-9 h-9 rounded-md object-cover border border-border/60 shadow-xs shrink-0"
              onError={(e) => {
                // hide broken images
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : category.icon ? (
            <span className="w-9 h-9 rounded-md bg-muted/60 border border-border/40 flex items-center justify-center text-lg shrink-0">
              {category.icon}
            </span>
          ) : (
            <div className="w-9 h-9 rounded-md bg-muted/40 border border-border/40 flex items-center justify-center text-muted-foreground text-xs shrink-0">
              🐾
            </div>
          )}
          <span className="font-medium">{category.name}</span>
        </div>
      )
    },
  },
  {
    accessorKey: "description",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Description" />
    ),
    cell: ({ row }) => {
      const description = row.getValue("description") as string
      return (
        <div className="max-w-[300px] truncate">
          {description || "No description"}
        </div>
      )
    },
  },
  {
    accessorKey: "color",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Color" />
    ),
    cell: ({ row }) => {
      const color = row.getValue("color") as string
      return color ? (
        <div className="flex items-center space-x-2">
          <div
            className="w-4 h-4 rounded border"
            style={{ backgroundColor: color }}
          />
          <span className="text-sm font-mono">{color}</span>
        </div>
      ) : (
        <span className="text-muted-foreground">No color</span>
      )
    },
  },
  {
    accessorKey: "sort_order",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Sort Order" />
    ),
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
  {
    accessorKey: "created_at",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created" />
    ),
    cell: ({ row }) => {
      const date = new Date(row.getValue("created_at"))
      return <div>{date.toLocaleDateString()}</div>
    },
  },
]
