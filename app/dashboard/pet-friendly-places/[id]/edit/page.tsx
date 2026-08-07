"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { PetFriendlyPlace } from "@/components/crud/pet-friendly-places/schema"
import { PetFriendlyPlaceForm } from "@/components/crud/pet-friendly-places/PetFriendlyPlaceForm"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface EditPetFriendlyPlacePageProps {
  params: {
    id: string
  }
}

export default function EditPetFriendlyPlacePage({ params }: EditPetFriendlyPlacePageProps) {
  const router = useRouter()
  const [place, setPlace] = useState<PetFriendlyPlace | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPlace()
  }, [params.id])

  const fetchPlace = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("pet_friendly_places")
        .select(`
          *,
          place_groups(group:groups(*)),
          service_provider:service_providers(*)
        `)
        .eq("pet_friendly_place_id", params.id)
        .single()

      if (error) throw error
      setPlace(data)
    } catch (error) {
      console.error("Error fetching pet friendly place:", error)
      toast.error("Failed to load pet friendly place")
      router.push("/dashboard/pet-friendly-places")
    } finally {
      setLoading(false)
    }
  }

  const handleSuccess = () => {
    toast.success("Pet friendly place updated successfully")
    router.push("/dashboard/pet-friendly-places")
  }

  const handleCancel = () => {
    router.push("/dashboard/pet-friendly-places")
  }

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (!place) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Pet Friendly Place Not Found</h1>
          <Button onClick={() => router.push("/dashboard/pet-friendly-places")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Places
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6">
      <div>
        <Button
          variant="ghost"
          onClick={() => router.push("/dashboard/pet-friendly-places")}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Places
        </Button>
        <h1 className="text-3xl font-bold">Edit Pet Friendly Place</h1>
        <p className="text-muted-foreground mt-1">
          Update details for &quot;{place.name}&quot;
        </p>
      </div>

      <div className="bg-card border rounded-xl p-6 shadow-sm">
        <PetFriendlyPlaceForm
          place={place}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      </div>
    </div>
  )
}
