"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { supabase } from "@/lib/supabase"
import { createLocation, updateLocation } from "@/lib/locations-api"
import { serviceProviderSchema, ServiceProvider } from "./schema"
import { Button } from "@/components/ui/button"
import { Form } from "@/components/ui/form"
import { toast } from "sonner"
import { validateServiceProviderName } from "@/lib/name-validation"
import { Loader2 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BasicInfoTab } from "./BasicInfoTab"
import { ContactLocationTab } from "./ContactLocationTab"
import { SettingsTab } from "./SettingsTab"
import { ServicesAndBreedsTab } from "./ServicesAndBreedsTab"
import { OperatingHoursTab } from "./OperatingHoursTab"
import { ImagesTab } from "./ImagesTab"
import { ServiceProviderImage } from "@/components/ui/multiple-image-upload"
import { ImageUploadService } from "@/lib/image-upload"
import { syncServiceProviderToPetFriendlyPlace } from "@/lib/sync-pet-friendly-places"

interface ServiceProviderFormProps {
  provider?: ServiceProvider
  preselectedCategoryId?: string
  onSuccess: () => void
  onCancel: () => void
}

export function ServiceProviderForm({ provider, preselectedCategoryId, onSuccess, onCancel }: ServiceProviderFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [categories, setCategories] = useState<any[]>([])
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>("")
  const [services, setServices] = useState<any[]>([])
  const [selectedBreeds, setSelectedBreeds] = useState<any[]>([])
  const [images, setImages] = useState<ServiceProviderImage[]>([])

  const form = useForm({
    resolver: zodResolver(serviceProviderSchema),
    defaultValues: provider ? {
      service_category_id: provider.service_category_id || 0,
      name: provider.name,
      description: provider.description || "",
      bio: provider.bio || "",
      image_url: provider.image_url || "",
      phone: provider.phone || "",
      emergency_number: provider.emergency_number || "",
      number_2: provider.number_2 || "",
      email: provider.email || "",
      website: provider.website || "",
      location_id: provider.location_id || 0,
      rating: provider.rating || 0,
      total_reviews: provider.total_reviews || 0,
      is_verified: provider.is_verified ?? false,
      is_active: provider.is_active ?? true,
      featured: provider.featured ?? false,
      address: provider.location?.address || "",
      latitude: provider.location?.latitude || "",
      longitude: provider.location?.longitude || "",
      show_publicly: provider.location?.show_publicly ?? true,
      operating_hours: provider.operating_hours || undefined,
    } : {
      service_category_id: preselectedCategoryId ? parseInt(preselectedCategoryId) : 0,
      name: "",
      description: "",
      bio: "",
      image_url: "",
      phone: "",
      emergency_number: "",
      number_2: "",
      email: "",
      website: "",
      location_id: 0,
      rating: 0,
      total_reviews: 0,
      is_verified: false,
      is_active: true,
      featured: false,
      address: "",
      latitude: "",
      longitude: "",
      show_publicly: true,
    },
  })

  useEffect(() => {
    fetchCategories()
    if (provider?.service_provider_id) {
      fetchProviderCategories(provider.service_provider_id)
      fetchPetFriendlyPlaceDetails(provider.service_provider_id)
    }
  }, [provider])

  const fetchPetFriendlyPlaceDetails = async (providerId: number) => {
    try {
      const { data: place } = await supabase
        .from("pet_friendly_places")
        .select("*, place_groups(group_id)")
        .eq("service_provider_id", providerId)
        .eq("is_deleted", false)
        .maybeSingle()

      if (place) {
        form.setValue("is_pet_friendly_place" as any, true)
        if (place.name) form.setValue("pet_friendly_name" as any, place.name)
        if (place.amenities) form.setValue("amenities" as any, place.amenities)
        if (place.place_groups && place.place_groups.length > 0) {
          form.setValue("pet_friendly_group_id" as any, place.place_groups[0].group_id)
        }
      }
    } catch (err) {
      console.error("Error fetching pet friendly place details:", err)
    }
  }

  const fetchProviderCategories = async (providerId: number) => {
    try {
      const { data } = await supabase
        .from("service_provider_categories")
        .select("service_category_id")
        .eq("service_provider_id", providerId)

      const linkedIds = (data || []).map((item: any) => item.service_category_id)
      const initialIds = Array.from(new Set([...linkedIds, provider?.service_category_id].filter(Boolean))) as number[]
      if (initialIds.length > 0) {
        form.setValue("category_ids" as any, initialIds)
      }
    } catch (err) {
      console.error("Error fetching provider categories:", err)
    }
  }

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("service_categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order")

      if (error) throw error
      setCategories(data || [])
      
      // Set selected category name if preselected
      if (preselectedCategoryId && data) {
        const selectedCategory = data.find(cat => cat.service_category_id === parseInt(preselectedCategoryId))
        if (selectedCategory) {
          setSelectedCategoryName(selectedCategory.name)
        }
      }
    } catch (error) {
      console.error("Error fetching categories:", error)
    }
  }


  const onSubmit = async (values: any) => {
    setIsLoading(true)
    try {
      // Ensure we capture the latest form values including any tab-specific data
      const currentValues = form.getValues()
      console.log("Form values before submit:", currentValues)
      console.log("Services state:", services)
      console.log("Selected breeds state:", selectedBreeds)
      
      // Use the current form values instead of validated values to ensure latest image_url
      const submissionValues = { ...currentValues }
      // Check name uniqueness
      const { isUnique, error: validationError } = await validateServiceProviderName(
        submissionValues.name,
        provider ? provider.service_provider_id : undefined
      );

      if (validationError) {
        toast.error(validationError);
        return;
      }

      if (!isUnique) {
        form.setError("name", {
          type: "manual",
          message: "A service provider with this name already exists"
        });
        return;
      }

      let locationId = submissionValues.location_id

      // Handle location creation or update
      if (submissionValues.address) {
        if (provider && provider.location_id) {
          const locationData = await updateLocation(provider.location_id, {
            address: submissionValues.address,
            latitude: submissionValues.latitude || null,
            longitude: submissionValues.longitude || null,
            show_publicly: submissionValues.show_publicly,
          })
          locationId = provider.location_id
        } else {
          const locationData = await createLocation({
            address: submissionValues.address,
            latitude: submissionValues.latitude || null,
            longitude: submissionValues.longitude || null,
            show_publicly: submissionValues.show_publicly,
          })
          locationId = locationData.location_id
        }
      }

      const profileImage = images.length > 0 ? images[0].image_url : (submissionValues.image_url || null)
      const allImageUrls = images.map(img => img.image_url)
      const categoryIds: number[] = (submissionValues as any).category_ids || (submissionValues.service_category_id ? [submissionValues.service_category_id] : [])
      const primaryCategoryId = categoryIds[0] || submissionValues.service_category_id || null

      const providerData = {
        service_category_id: primaryCategoryId,
        name: submissionValues.name,
        description: submissionValues.description || null,
        bio: submissionValues.bio || null,
        image_url: profileImage,
        images: allImageUrls.length > 0 ? allImageUrls : (profileImage ? [profileImage] : []),
        phone: submissionValues.phone || null,
        emergency_number: submissionValues.emergency_number || submissionValues.phone || null,
        number_2: submissionValues.number_2 || null,
        email: submissionValues.email || null,
        website: submissionValues.website || null,
        location_id: locationId || null,
        rating: submissionValues.rating,
        total_reviews: submissionValues.total_reviews,
        is_verified: submissionValues.is_verified,
        is_active: submissionValues.is_active,
        featured: submissionValues.featured,
        operating_hours: submissionValues.operating_hours || null,
      }

      const petFriendlyInfo = {
        is_pet_friendly_place: (submissionValues as any).is_pet_friendly_place || false,
        pet_friendly_name: (submissionValues as any).pet_friendly_name || null,
        pet_friendly_group_id: (submissionValues as any).pet_friendly_group_id || null,
        amenities: (submissionValues as any).amenities || [],
      }

      const locationPayload = {
        address: submissionValues.address || null,
        latitude: submissionValues.latitude || null,
        longitude: submissionValues.longitude || null,
      }

      if (provider) {
        // Get session token to authenticate the PATCH request
        const { data: { session } } = await supabase.auth.getSession()
        const accessToken = session?.access_token

        // Use the API endpoint (supabaseAdmin) instead of direct Supabase client
        // to bypass RLS restrictions that would silently block updates
        const patchRes = await fetch(
          `/api/v1/service-providers?service_provider_id=${provider.service_provider_id}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
            },
            body: JSON.stringify({
              ...providerData,
              ...locationPayload,
              category_ids: categoryIds,
              ...petFriendlyInfo,
            }),
          }
        )
        if (!patchRes.ok) {
          const errBody = await patchRes.json().catch(() => ({}))
          throw new Error(errBody.error || `Update failed with status ${patchRes.status}`)
        }




        // Update services - always delete existing first, then insert new ones if any
        await supabase
          .from("services")
          .delete()
          .eq("service_provider_id", provider.service_provider_id)

        // Then insert new services if any
        if (services.length > 0) {
          const validServices = services.filter(service => service.name.trim())
          if (validServices.length > 0) {
            const servicesData = validServices.map(service => ({
              service_provider_id: provider.service_provider_id,
              name: service.name,
              description: service.description || null,
              price: service.price,
              duration_minutes: service.duration_minutes,
              is_active: service.is_active
            }))

            const { error: servicesError } = await supabase
              .from("services")
              .insert(servicesData)

            if (servicesError) {
              console.error("Error updating services:", servicesError)
              toast.error("Service provider updated but failed to update services")
            }
          }
        }

        // Update breeds
        await supabase
          .from("service_provider_breeds")
          .delete()
          .eq("service_provider_id", provider.service_provider_id)

        if (selectedBreeds.length > 0) {
          const breedsData = selectedBreeds.map(breed => ({
            service_provider_id: provider.service_provider_id,
            breed_id: breed.breed_id
          }))

          const { error: breedsError } = await supabase
            .from("service_provider_breeds")
            .insert(breedsData)

          if (breedsError) {
            console.error("Error updating breeds:", breedsError)
            toast.error("Service provider updated but failed to update breeds")
          }
        }

        // Fetch existing images before updating to clean up storage
        const { data: existingImages } = await supabase
          .from("service_provider_images")
          .select("image_url")
          .eq("service_provider_id", provider.service_provider_id)

        await supabase
          .from("service_provider_images")
          .delete()
          .eq("service_provider_id", provider.service_provider_id)

        const allImages: ServiceProviderImage[] = []

        if (profileImage && !images.some(img => img.image_url === profileImage)) {
          allImages.push({ image_url: profileImage, order: 0 })
        }

        images.forEach((img) => {
          if (!allImages.some(i => i.image_url === img.image_url)) {
            allImages.push({ ...img, order: allImages.length })
          }
        })

        if (allImages.length > 0) {
          const imageData = allImages.map((img, index) => ({
            service_provider_id: provider.service_provider_id,
            image_url: img.image_url,
            order: index,
          }))

          const { error: imagesError } = await supabase
            .from("service_provider_images")
            .insert(imageData)

          if (imagesError) {
            console.error("Error saving images:", imagesError)
            toast.error("Service provider updated but failed to save images")
          }
        }

        // Delete removed images from storage
        if (existingImages) {
          const newUrls = new Set(allImages.map(img => img.image_url))
          for (const img of existingImages) {
            if (!newUrls.has(img.image_url)) {
              const filePath = ImageUploadService.extractFilePathFromUrl(img.image_url)
              if (filePath) {
                try {
                  await ImageUploadService.deleteImage(filePath)
                } catch (e) {
                  console.warn("Failed to delete old image from storage:", e)
                }
              }
            }
          }
        }

        toast.success("Service provider updated successfully")
      } else {
        const { data: providerResult, error } = await supabase
          .from("service_providers")
          .insert([providerData])
          .select()
          .single()

        if (error) throw error

        const serviceProviderId = providerResult.service_provider_id

        await syncServiceProviderToPetFriendlyPlace(
          serviceProviderId,
          { ...providerData, ...locationPayload },
          petFriendlyInfo
        )

        // Sync service_provider_categories
        if (categoryIds.length > 0) {
          const categoryData = categoryIds.map((catId: number) => ({
            service_provider_id: serviceProviderId,
            service_category_id: catId,
          }))
          await supabase.from("service_provider_categories").insert(categoryData)
        }

        // Save services if any
        if (services.length > 0) {
          const validServices = services.filter(service => service.name.trim())
          if (validServices.length > 0) {
            const servicesData = validServices.map(service => ({
              service_provider_id: serviceProviderId,
              name: service.name,
              description: service.description || null,
              price: service.price,
              duration_minutes: service.duration_minutes,
              is_active: service.is_active
            }))

            const { error: servicesError } = await supabase
              .from("services")
              .insert(servicesData)

            if (servicesError) {
              console.error("Error saving services:", servicesError)
              toast.error("Service provider created but failed to save services")
            }
          }
        }

        if (selectedBreeds.length > 0) {
          const breedsData = selectedBreeds.map(breed => ({
            service_provider_id: serviceProviderId,
            breed_id: breed.breed_id
          }))

          const { error: breedsError } = await supabase
            .from("service_provider_breeds")
            .insert(breedsData)

          if (breedsError) {
            console.error("Error saving breeds:", breedsError)
            toast.error("Service provider created but failed to save breeds")
          }
        }

        // Save images if any (includes profile image as first)
        const allImages: ServiceProviderImage[] = []

        if (providerData.image_url && !images.some(img => img.image_url === providerData.image_url)) {
          allImages.push({ image_url: providerData.image_url, order: 0 })
        }

        images.forEach((img) => {
          if (!allImages.some(i => i.image_url === img.image_url)) {
            allImages.push({ ...img, order: allImages.length })
          }
        })

        if (allImages.length > 0) {
          const imageData = allImages.map((img, index) => ({
            service_provider_id: serviceProviderId,
            image_url: img.image_url,
            order: index,
          }))

          const { error: imagesError } = await supabase
            .from("service_provider_images")
            .insert(imageData)

          if (imagesError) {
            console.error("Error saving images:", imagesError)
            toast.error("Service provider created but failed to save images")
          }
        }

        toast.success("Service provider created successfully")
      }

      onSuccess()
    } catch (error) {
      console.error("Error saving service provider:", error)
      toast.error("Failed to save service provider")
    } finally {
      setIsLoading(false)
    }
  }

  const handleFormError = (errors: any) => {
    console.error("Form validation errors:", errors)
    const errorKeys = Object.keys(errors)
    if (errorKeys.length > 0) {
      const firstField = errorKeys[0]
      const firstError = errors[firstField]?.message || "Please check required fields"
      toast.error(`Validation Error: ${firstError} (${firstField})`)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, handleFormError)} className="space-y-6">
        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="images">Images</TabsTrigger>
            <TabsTrigger value="contact">Contact & Location</TabsTrigger>
            <TabsTrigger value="hours">Operating Hours</TabsTrigger>
            <TabsTrigger value="services">Services & Breeds</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent forceMount value="basic">
            <BasicInfoTab 
              form={form} 
              categories={categories}
              hideCategorySelector={!!preselectedCategoryId}
              selectedCategoryName={selectedCategoryName}
            />
          </TabsContent>

          <TabsContent forceMount value="images">
            <ImagesTab 
              serviceProviderId={provider?.service_provider_id}
              onImagesChange={setImages}
            />
          </TabsContent>

          <TabsContent forceMount value="contact">
            <ContactLocationTab form={form} />
          </TabsContent>

          <TabsContent forceMount value="hours">
            <OperatingHoursTab form={form} />
          </TabsContent>

          <TabsContent forceMount value="services">
            <ServicesAndBreedsTab 
              serviceCategoryId={form.watch("service_category_id")}
              serviceProviderId={provider?.service_provider_id}
              onServicesChange={setServices}
              onBreedsChange={setSelectedBreeds}
            />
          </TabsContent>

          <TabsContent forceMount value="settings">
            <SettingsTab form={form} />
          </TabsContent>
        </Tabs>

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {provider ? "Update" : "Create"} Provider
          </Button>
        </div>
      </form>
    </Form>
  )
}
