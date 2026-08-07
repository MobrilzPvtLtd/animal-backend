"use client"

import { useRouter } from "next/navigation"
import { PetFriendlyPlaceForm } from "@/components/crud/pet-friendly-places/PetFriendlyPlaceForm"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export default function AddPetFriendlyPlacePage() {
  const router = useRouter()

  const handleSuccess = () => {
    router.push("/dashboard/pet-friendly-places")
  }

  const handleCancel = () => {
    router.push("/dashboard/pet-friendly-places")
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
        <h1 className="text-3xl font-bold">Add New Pet Friendly Place</h1>
        <p className="text-muted-foreground mt-1">
          Create a new pet friendly location or group branch location.
        </p>
      </div>

      <div className="bg-card border rounded-xl p-6 shadow-sm">
        <PetFriendlyPlaceForm
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      </div>
    </div>
  )
}
