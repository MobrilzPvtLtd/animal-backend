"use client"

import { ColumnDef } from "@tanstack/react-table"
import { SupportTicket, parseTicketMessage } from "./schema"
import { DataTableColumnHeader } from "../DataTableColumnHeader"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

const statusStyles: Record<string, string> = {
  open: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
  in_progress: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  resolved: "bg-green-100 text-green-800 hover:bg-green-100",
  closed: "bg-gray-100 text-gray-800 hover:bg-gray-100",
}

const priorityStyles: Record<string, string> = {
  low: "bg-slate-100 text-slate-600 hover:bg-slate-100",
  medium: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  high: "bg-orange-100 text-orange-700 hover:bg-orange-100",
  urgent: "bg-red-100 text-red-700 hover:bg-red-100",
}

function getCategoryBadgeClass(category: string | null): string {
  if (!category) return "bg-gray-50 text-gray-700 border-gray-200";
  const lower = category.toLowerCase();
  if (lower.includes("general")) return "bg-blue-50 text-blue-700 border-blue-200";
  if (lower.includes("billing") || lower.includes("subscription")) return "bg-purple-50 text-purple-700 border-purple-200";
  if (lower.includes("provider")) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (lower.includes("tech") || lower.includes("bug") || lower.includes("issue")) return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-indigo-50 text-indigo-700 border-indigo-200";
}

export const columns: ColumnDef<SupportTicket>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "subject",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Subject & Label" />
    ),
    cell: ({ row }) => {
      const ticket = row.original
      const { category } = parseTicketMessage(ticket.initial_message)
      return (
        <div className="flex items-center gap-2.5">
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarImage src={ticket.users?.profile_image_url || ""} />
            <AvatarFallback className="text-xs">
              {ticket.users?.name?.charAt(0) || ticket.users?.email?.charAt(0) || "?"}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                #{ticket.support_ticket_id}
              </span>
              <span className="font-medium text-sm truncate max-w-[280px]">{ticket.subject}</span>
            </div>
            {category && (
              <span className={`inline-block text-[11px] font-medium border px-2 py-0.5 rounded-full ${getCategoryBadgeClass(category)}`}>
                {category}
              </span>
            )}
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: "users.name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="User" />
    ),
    cell: ({ row }) => {
      const user = row.original.users
      if (!user) {
        return <div className="text-xs text-muted-foreground italic">Anonymous / Guest</div>
      }
      const fullName = `${user.name || ""} ${user.surname || ""}`.trim()
      return (
        <div className="space-y-0.5 max-w-[190px]">
          <div className="text-sm font-medium truncate">{fullName || user.email}</div>
          {fullName && user.email && (
            <div className="text-xs text-muted-foreground truncate">{user.email}</div>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: "priority",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Priority" />
    ),
    cell: ({ row }) => {
      const priority = row.getValue("priority") as string
      return (
        <Badge variant="outline" className={priorityStyles[priority] || ""}>
          {priority}
        </Badge>
      )
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status = row.getValue("status") as string
      return (
        <Badge variant="outline" className={statusStyles[status] || ""}>
          {status.replace("_", " ")}
        </Badge>
      )
    },
  },
  {
    accessorKey: "assigned_user",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Assigned To" />
    ),
    cell: ({ row }) => {
      const assigned = row.original.assigned_user
      if (!assigned) return <span className="text-muted-foreground text-sm">—</span>
      const name = `${assigned.name || ""} ${assigned.surname || ""}`.trim() || assigned.email
      return <div className="text-sm">{name}</div>
    },
  },
  {
    accessorKey: "created_at",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created" />
    ),
    cell: ({ row }) => {
      const date = row.getValue("created_at") as string
      return <div className="text-sm">{new Date(date).toLocaleDateString()}</div>
    },
  },
]
