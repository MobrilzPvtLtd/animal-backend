"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Breed, breedSchema, AnimalType } from "./schema"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { MultipleImageUpload, ServiceProviderImage } from "@/components/ui/multiple-image-upload"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { validateBreedName } from "@/lib/name-validation"

interface BreedFormProps {
  breed?: Breed
  onSuccess: () => void
  onCancel: () => void
}

export function BreedForm({ breed, onSuccess, onCancel }: BreedFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [animalTypes, setAnimalTypes] = useState<AnimalType[]>([])
  const isEditing = !!breed

  // Initialize form with default values or existing breed data
  const form = useForm<Breed>({
    resolver: zodResolver(breedSchema),
    defaultValues: breed ? {
      name: breed.name,
      description: breed.description || "",
      image_url: breed.image_url || "",
      images: (breed as any).images || (breed.image_url ? [breed.image_url] : []),
      animal_type_id: breed.animal_type_id,
    } : {
      name: "",
      description: "",
      image_url: "",
      images: [],
      animal_type_id: undefined,
    },
  })

  useEffect(() => {
    form.reset(
      breed
        ? {
            name: breed.name,
            description: breed.description || "",
            image_url: breed.image_url || "",
            images: (breed as any).images || (breed.image_url ? [breed.image_url] : []),
            animal_type_id: breed.animal_type_id,
            breed_id: breed.breed_id,
            created_at: breed.created_at,
            animal_type: breed.animal_type || null,
          }
        : {
            name: "",
            description: "",
            image_url: "",
            images: [],
            animal_type_id: undefined,
          }
    )
  }, [breed, form])

  useEffect(() => {
    fetchAnimalTypes()
  }, [])

  const fetchAnimalTypes = async () => {
    try {
      const response = await fetch("/api/v1/animal-types")
      const result = await response.json()

      if (!response.ok) throw new Error(result.error || "Failed to load animal types")
      const data = result.data || []
      setAnimalTypes(data || [])
    } catch (error) {
      console.error("Error fetching animal types:", error)
      toast.error("Failed to load animal types")
    }
  }

  async function onSubmit(data: Breed) {
    setIsLoading(true)
    try {
      // Check name uniqueness
      const { isUnique, error: validationError } = await validateBreedName(
        data.name,
        isEditing ? breed.breed_id : undefined
      );

      if (validationError) {
        toast.error(validationError);
        return;
      }

      if (!isUnique) {
        form.setError("name", {
          type: "manual",
          message: "A breed with this name already exists"
        });
        return;
      }

      const imagesList = data.images && data.images.length > 0 ? data.images : (data.image_url ? [data.image_url] : []);

      const payload = {
        name: data.name,
        description: data.description || null,
        image_url: imagesList[0] || null,
        images: imagesList,
        animal_type_id: data.animal_type_id,
      }

      if (isEditing) {
        // Update existing breed
        const response = await fetch(`/api/v1/breeds/${breed.breed_id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        })

        const result = await response.json()
        if (!response.ok) throw new Error(result.error || "Failed to update breed")
        toast.success("Breed updated successfully")
      } else {
        // Create new breed
        const response = await fetch("/api/v1/breeds", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        })

        const result = await response.json()
        if (!response.ok) throw new Error(result.error || "Failed to create breed")
        toast.success("Breed created successfully")
      }

      onSuccess()
    } catch (error) {
      console.error("Error saving breed:", error)
      toast.error("Failed to save breed")
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
                <Input placeholder="Enter breed name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter breed description"
                  className="resize-none"
                  {...field}
                  value={field.value || ""}
                />
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
                  folder="breeds"
                  label="Breed Images"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="animal_type_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Animal Type</FormLabel>
              <Select
                onValueChange={(value) => field.onChange(parseInt(value))}
                value={field.value ? field.value.toString() : ""}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select animal type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {animalTypes.map((type) => (
                    <SelectItem
                      key={type.animal_type_id}
                      value={type.animal_type_id.toString()}
                    >
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Update Breed" : "Create Breed"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
