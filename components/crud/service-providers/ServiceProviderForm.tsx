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
import { OperatingHoursTab, DEFAULT_HOURS } from "./OperatingHoursTab"
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

  const handleImagesChange = (newImages: ServiceProviderImage[]) => {
    setImages(newImages)
    form.setValue("image_url", newImages.length > 0 ? newImages[0].image_url : "")
  }

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
      show_operating_hours: (provider as any).show_operating_hours ?? true,
      operating_hours: provider.operating_hours || DEFAULT_HOURS,
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
      show_operating_hours: true,
      operating_hours: DEFAULT_HOURS,
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

      // Source of truth for images is the user-managed images state from ImagesTab
      const finalImageUrls = images.map(img => img.image_url).filter(Boolean)
      const profileImage = finalImageUrls.length > 0 ? finalImageUrls[0] : null
      const categoryIds: number[] = (submissionValues as any).category_ids || (submissionValues.service_category_id ? [submissionValues.service_category_id] : [])
      const primaryCategoryId = categoryIds[0] || submissionValues.service_category_id || null

      const providerData = {
        service_category_id: primaryCategoryId,
        name: submissionValues.name,
        description: submissionValues.description || null,
        bio: submissionValues.bio || null,
        image_url: profileImage,
        images: finalImageUrls,
        phone: submissionValues.phone || null,
        emergency_number: submissionValues.emergency_number?.trim() || null,
        number_2: submissionValues.number_2 || null,
        email: submissionValues.email || null,
        website: submissionValues.website || null,
        location_id: locationId || null,
        rating: submissionValues.rating,
        total_reviews: submissionValues.total_reviews,
        is_verified: submissionValues.is_verified,
        is_active: submissionValues.is_active,
        featured: submissionValues.featured,
        show_operating_hours: submissionValues.show_operating_hours ?? true,
        operating_hours: (submissionValues.show_operating_hours !== false) ? (submissionValues.operating_hours || DEFAULT_HOURS) : null,
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

      const validServices = services
        .filter(service => service.name?.trim())
        .map(service => ({
          name: service.name.trim(),
          description: service.description || null,
          price: service.price !== undefined && service.price !== null && service.price !== '' ? Number(service.price) : null,
          duration_minutes: service.duration_minutes ? Number(service.duration_minutes) : null,
          is_active: service.is_active ?? true,
        }))

      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token

      if (provider) {
        // Fetch existing images before updating to clean up storage
        const { data: existingImages } = await supabase
          .from("service_provider_images")
          .select("image_url")
          .eq("service_provider_id", provider.service_provider_id)

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
              images: finalImageUrls,
              services: validServices,
              breed_ids: selectedBreeds.map(breed => breed.breed_id),
            }),
          }
        )
        if (!patchRes.ok) {
          const errBody = await patchRes.json().catch(() => ({}))
          throw new Error(errBody.error || `Update failed with status ${patchRes.status}`)
        }

        // Delete removed images from storage
        if (existingImages) {
          const newUrls = new Set(finalImageUrls)
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
        const createRes = await fetch('/api/v1/service-providers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({
            ...providerData,
            ...locationPayload,
            category_ids: categoryIds,
            ...petFriendlyInfo,
            images: finalImageUrls,
            services: validServices,
            breed_ids: selectedBreeds.map(breed => breed.breed_id),
          }),
        })

        if (!createRes.ok) {
          const errBody = await createRes.json().catch(() => ({}))
          throw new Error(errBody.error || `Create failed with status ${createRes.status}`)
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
              initialImages={
                Array.isArray((provider as any)?.images) && (provider as any).images.length > 0
                  ? (provider as any).images
                  : (provider?.image_url ? [provider.image_url] : [])
              }
              onImagesChange={handleImagesChange}
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
