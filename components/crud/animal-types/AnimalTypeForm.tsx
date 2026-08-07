"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AnimalType, animalTypeSchema } from "./schema"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { MultipleImageUpload, ServiceProviderImage } from "@/components/ui/multiple-image-upload"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { validateAnimalTypeName } from "@/lib/name-validation"

interface AnimalTypeFormProps {
  animalType?: AnimalType
  onSuccess: () => void
  onCancel: () => void
}

export function AnimalTypeForm({ animalType, onSuccess, onCancel }: AnimalTypeFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const isEditing = !!animalType

  // Initialize form with default values or existing animal type data
  const form = useForm<AnimalType>({
    resolver: zodResolver(animalTypeSchema),
    defaultValues: animalType ? {
      name: animalType.name,
      image_url: animalType.image_url || "",
      images: (animalType as any).images || (animalType.image_url ? [animalType.image_url] : []),
    } : {
      name: "",
      image_url: "",
      images: [],
    },
  })

  useEffect(() => {
    form.reset(
      animalType
        ? {
            name: animalType.name,
            image_url: animalType.image_url || "",
            images: (animalType as any).images || (animalType.image_url ? [animalType.image_url] : []),
          }
        : {
            name: "",
            image_url: "",
            images: [],
          }
    )
  }, [animalType, form])

  async function onSubmit(data: AnimalType) {
    setIsLoading(true)
    try {
      // Check name uniqueness
      const { isUnique, error: validationError } = await validateAnimalTypeName(
        data.name,
        isEditing ? animalType.animal_type_id : undefined
      );

      if (validationError) {
        toast.error(validationError);
        return;
      }

      if (!isUnique) {
        form.setError("name", {
          type: "manual",
          message: "An animal type with this name already exists"
        });
        return;
      }

      const imagesList = data.images && data.images.length > 0 ? data.images : (data.image_url ? [data.image_url] : []);

      const payload = {
        name: data.name,
        image_url: imagesList[0] || null,
        images: imagesList,
      }

      if (isEditing) {
        // Update existing animal type
        const response = await fetch(`/api/v1/animal-types/${animalType.animal_type_id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        })

        const result = await response.json()
        if (!response.ok) throw new Error(result.error || "Failed to update animal type")
        toast.success("Animal type updated successfully")
      } else {
        // Create new animal type
        const response = await fetch("/api/v1/animal-types", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        })

        const result = await response.json()
        if (!response.ok) throw new Error(result.error || "Failed to create animal type")
        toast.success("Animal type created successfully")
      }

      onSuccess()
    } catch (error) {
      console.error("Error saving animal type:", error)
      toast.error("Failed to save animal type")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter animal type name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={"images" as any}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <MultipleImageUpload
                  value={((field.value && field.value.length > 0 ? field.value : (form.watch("image_url") ? [form.watch("image_url")] : [])) as string[]).map((url: string, index: number) => ({
                    image_url: url,
                    order: index + 1
                  }))}
                  onChange={(newImages: ServiceProviderImage[]) => {
                    const urls = newImages.map(img => img.image_url);
                    field.onChange(urls);
                    form.setValue("image_url", urls[0] || "");
                  }}
                  folder="animal-types"
                  label="Animal Type Images"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-4">
          <Button variant="outline" onClick={onCancel} type="button">
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Update" : "Create"} Animal Type
          </Button>
        </div>
      </form>
    </Form>
  )
}
