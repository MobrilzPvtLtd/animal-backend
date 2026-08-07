"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { PetFriendlyPlace } from "./schema"
import { columns } from "./columns"
import { DataTable } from "../DataTable"
import { Button } from "@/components/ui/button"
import { PlusCircle, Loader2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"

export function PetFriendlyPlacesCrud() {
  const router = useRouter()
  const [places, setPlaces] = useState<PetFriendlyPlace[]>([])
  const [loading, setLoading] = useState(true)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedPlace, setSelectedPlace] = useState<PetFriendlyPlace | null>(null)

  useEffect(() => {
    fetchPlaces()
  }, [])

  const fetchPlaces = async () => {
    setLoading(true)
    try {
      const { data: placesData, error: placesError } = await supabase
        .from("pet_friendly_places")
        .select(`*, place_groups(group:groups(*))`)
        .eq("is_deleted", false)
        .order("name")

      if (placesError) throw placesError

      setPlaces(placesData || [])
    } catch (error) {
      console.error("Error fetching pet friendly places:", error)
      toast.error("Failed to load pet friendly places")
    } finally {
      setLoading(false)
    }
  }

  const handleAddPlace = () => {
    router.push("/dashboard/pet-friendly-places/add")
  }

  const handleEditPlace = (place: PetFriendlyPlace) => {
    router.push(`/dashboard/pet-friendly-places/${place.pet_friendly_place_id}/edit`)
  }

  const handleDeletePlace = (place: PetFriendlyPlace) => {
    setSelectedPlace(place)
    setIsDeleteDialogOpen(true)
  }

  const confirmDeletePlace = async () => {
    if (!selectedPlace) return

    try {
      const { error } = await supabase
        .from("pet_friendly_places")
        .update({ is_deleted: true })
        .eq("pet_friendly_place_id", selectedPlace.pet_friendly_place_id)

      if (error) throw error

      setPlaces(places.filter(p => p.pet_friendly_place_id !== selectedPlace.pet_friendly_place_id))
      toast.success("Pet friendly place deleted successfully")
    } catch (error) {
      console.error("Error deleting pet friendly place:", error)
      toast.error("Failed to delete pet friendly place")
    } finally {
      setIsDeleteDialogOpen(false)
      setSelectedPlace(null)
    }
  }

  // Enhanced columns with edit and delete actions
  const enhancedColumns = [
    ...columns,
    {
      id: "edit",
      cell: ({ row }: { row: any }) => {
        const place = row.original
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEditPlace(place)}
          >
            Edit
          </Button>
        )
      },
    },
    {
      id: "delete",
      cell: ({ row }: { row: any }) => {
        const place = row.original
        return (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => handleDeletePlace(place)}
          >
            Delete
          </Button>
        )
      },
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Pet Friendly Places Management</h2>
          <p className="text-sm text-muted-foreground">
            Manage pet friendly locations and brand group branch locations.
          </p>
        </div>
        <Button onClick={handleAddPlace}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Place
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <DataTable
          columns={enhancedColumns}
          data={places}
          filterKey="name"
          filterPlaceholder="Filter places by name..."
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the pet friendly place as deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedPlace(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeletePlace} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
