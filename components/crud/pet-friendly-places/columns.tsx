"use client"

import { ColumnDef } from "@tanstack/react-table"
import { PetFriendlyPlace } from "./schema"
import { DataTableColumnHeader } from "../DataTableColumnHeader"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Clock, MapPin, Phone } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

function OperatingHoursBadge({ operating_hours }: { operating_hours?: any }) {
  if (!operating_hours) return <span className="text-muted-foreground">Not set</span>

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
  const todayHours = operating_hours[today]

  if (!todayHours?.isOpen) {
    return (
      <Badge variant="secondary" className="text-xs">
        <Clock className="h-3 w-3 mr-1" />
        Closed today
      </Badge>
    )
  }

  const openTime = new Date(`2000-01-01T${todayHours.openTime}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const closeTime = new Date(`2000-01-01T${todayHours.closeTime}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

  return (
    <Badge variant="outline" className="text-xs">
      <Clock className="h-3 w-3 mr-1" />
      Today: {openTime} - {closeTime}
    </Badge>
  )
}

export const columns: ColumnDef<PetFriendlyPlace>[] = [
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
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => {
      const place = row.original
      return (
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={place.image_url || ""} alt={place.name} />
            <AvatarFallback>{place.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="font-medium">{place.name}</div>
        </div>
      )
    },
  },
  {
    id: "group",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Parent Group" />
    ),
    cell: ({ row }) => {
      const place = row.original as any
      const groupName = place.place_groups?.[0]?.group?.name || place.group?.name
      if (!groupName) {
        return <Badge variant="secondary" className="text-xs">Standalone</Badge>
      }
      return (
        <Badge variant="outline" className="text-xs font-medium border-primary/40 text-primary bg-primary/5">
          🏢 {groupName}
        </Badge>
      )
    },
  },
  {
    id: "operating_hours",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Hours" />
    ),
    cell: ({ row }) => {
      const place = row.original
      return <OperatingHoursBadge operating_hours={(place as any).operating_hours} />
    },
  },
  {
    accessorKey: "phone",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Contact" />
    ),
    cell: ({ row }) => {
      const phone = row.getValue("phone") as string | undefined
      return (
        <div className="flex items-center">
          {phone ? (
            <div className="flex items-center">
              <Phone className="mr-1 h-4 w-4 text-muted-foreground" />
              <span>{phone}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">No phone</span>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: "location",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Location" />
    ),
    cell: ({ row }) => {
      const place = row.original
      const displayAddress = place.address || (place as any).location?.address
      return (
        <div className="flex items-center">
          {displayAddress ? (
            <div className="flex items-center">
              <MapPin className="mr-1 h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate max-w-[200px]">{displayAddress}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">No location</span>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: "is_verified",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Verified" />
    ),
    cell: ({ row }) => {
      const isVerified = (row.original as any).is_verified as boolean | undefined
      return (
        <Badge variant={isVerified ? "default" : "secondary"}>
          {isVerified ? "Verified" : "Unverified"}
        </Badge>
      )
    },
  },
]
