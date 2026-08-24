"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { supabase } from "@/lib/supabase"
import { createLocation, fetchLocations } from "@/lib/locations-api"
import { validateServiceProviderName } from "@/lib/name-validation"
import { serviceProviderSchema } from "./schema"
import { Button } from "@/components/ui/button"
import { Form } from "@/components/ui/form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { Loader2, ArrowLeft, ArrowRight } from "lucide-react"
import { WizardProgressBar } from "./WizardProgressBar"
import { BasicInfoTab } from "./BasicInfoTab"
import { ContactLocationTab } from "./ContactLocationTab"
import { SettingsTab } from "./SettingsTab"
import { ServicesAndBreedsTab } from "./ServicesAndBreedsTab"
import { OperatingHoursTab } from "./OperatingHoursTab"
import { ImagesTab } from "./ImagesTab"
import { ServiceProviderImage } from "@/components/ui/multiple-image-upload"
import { syncServiceProviderToPetFriendlyPlace } from "@/lib/sync-pet-friendly-places"

const WIZARD_STEPS = [
  { id: 1, label: "Basic Info", component: "basic" },
  { id: 2, label: "Images", component: "images" },
  { id: 3, label: "Contact & Location", component: "contact" },
  { id: 4, label: "Operating Hours", component: "hours" },
  { id: 5, label: "Settings", component: "settings" },
  { id: 6, label: "Services & Breeds", component: "services" },
]

interface ServiceProviderWizardProps {
  preselectedCategoryId?: string
}

export function ServiceProviderWizard({ preselectedCategoryId }: ServiceProviderWizardProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [categories, setCategories] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>("")
  const [services, setServices] = useState<any[]>([])
  const [selectedBreeds, setSelectedBreeds] = useState<any[]>([])
  const [images, setImages] = useState<ServiceProviderImage[]>([])
  const router = useRouter()

  const form = useForm({
    resolver: zodResolver(serviceProviderSchema),
    defaultValues: {
      service_category_id: preselectedCategoryId ? parseInt(preselectedCategoryId) : 0,
      category_ids: preselectedCategoryId ? [parseInt(preselectedCategoryId)] : [],
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
      is_verified: false,
      is_active: true,
      featured: false,
      address: "",
      latitude: "",
      longitude: "",
      show_publicly: true,
      show_operating_hours: false,
      operating_hours: undefined,
    },
  })

  useEffect(() => {
    fetchCategories()
    loadLocations()
  }, [])

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

  const loadLocations = async () => {
    try {
      const data = await fetchLocations()
      setLocations(data || [])
    } catch (error) {
      console.error("Error fetching locations:", error)
    }
  }

  const validateCurrentStep = async () => {
    const values = form.getValues()
    
    switch (currentStep) {
      case 1: {
        // Validate basic info (Category & Name)
        const isNameValid = await form.trigger("name")
        const categoryIds = (values as any).category_ids || []
        const hasCategory = (categoryIds && categoryIds.length > 0) || (values.service_category_id && values.service_category_id > 0)
        
        if (!hasCategory) {
          form.setError("category_ids" as any, {
            type: "manual",
            message: "Please select at least one category"
          })
          toast.error("Please select at least one category")
          return false
        } else {
          form.clearErrors("category_ids" as any)
        }

        if (!isNameValid || !values.name?.trim()) {
          toast.error("Please enter a provider name (at least 2 characters)")
          return false
        }
        break
      }
      case 2:
        // Images are optional
        break
      case 3: {
        // Validate contact & location formats
        const isEmailValid = await form.trigger("email")
        const isWebsiteValid = await form.trigger("website")
        if (!isEmailValid || !isWebsiteValid) {
          toast.error("Please fix errors in Contact & Location details")
          return false
        }
        break
      }
    }
    return true
  }

  const handleNext = async () => {
    const isValid = await validateCurrentStep()
    if (isValid && currentStep < WIZARD_STEPS.length) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleCancel = () => {
    router.push("/dashboard/service-providers")
  }

  const handleFormError = (errors: any) => {
    console.error("Form validation errors:", errors)
    const errorKeys = Object.keys(errors)
    if (errorKeys.length > 0) {
      const firstField = errorKeys[0]
      const firstError = errors[firstField]?.message || "Please check required fields"
      toast.error(`Validation Error (${firstField}): ${firstError}`)
      
      // Auto-navigate to step containing the error
      if (["service_category_id", "category_ids", "name", "description", "bio"].includes(firstField)) {
        setCurrentStep(1)
      } else if (["image_url"].includes(firstField)) {
        setCurrentStep(2)
      } else if (["phone", "emergency_number", "number_2", "email", "website", "address", "latitude", "longitude"].includes(firstField)) {
        setCurrentStep(3)
      } else if (["operating_hours"].includes(firstField)) {
        setCurrentStep(4)
      } else if (["is_verified", "is_active", "featured"].includes(firstField)) {
        setCurrentStep(5)
      }
    }
  }

  const onSubmit = async (values: any) => {
    setIsLoading(true)
    try {
      const currentFormValues = form.getValues()
      const submissionValues = { ...currentFormValues }

      // Validate provider name uniqueness
      if (submissionValues.name) {
        const { isUnique, error: nameValError } = await validateServiceProviderName(submissionValues.name)
        if (nameValError) {
          toast.error(nameValError)
          setIsLoading(false)
          return
        }
        if (!isUnique) {
          toast.error("A service provider with this name already exists")
          setCurrentStep(1)
          form.setError("name", { type: "manual", message: "Name already exists" })
          setIsLoading(false)
          return
        }
      }

      let locationId = submissionValues.location_id

      // Create location if address is provided and no location is selected
      if (submissionValues.address && !locationId) {
        const locationData = await createLocation({
          address: submissionValues.address,
          latitude: submissionValues.latitude || null,
          longitude: submissionValues.longitude || null,
          show_publicly: submissionValues.show_publicly,
        })
        locationId = locationData.location_id
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
        emergency_number: submissionValues.emergency_number || null,
        number_2: submissionValues.number_2 || null,
        email: submissionValues.email || null,
        website: submissionValues.website || null,
        location_id: locationId || null,
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
        const validServices = services.filter(service => service.name?.trim())
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
      router.push("/dashboard/service-providers")
    } catch (error: any) {
      console.error("Error saving service provider:", error)
      toast.error(error?.message || "Failed to save service provider")
    } finally {
      setIsLoading(false)
    }
  }

  const renderCurrentStep = () => {
    return (
      <>
        <div style={{ display: currentStep === 1 ? 'block' : 'none' }}>
          <BasicInfoTab 
            form={form} 
            categories={categories}
            hideCategorySelector={!!preselectedCategoryId}
            selectedCategoryName={selectedCategoryName}
          />
        </div>
        <div style={{ display: currentStep === 2 ? 'block' : 'none' }}>
          <ImagesTab 
            onImagesChange={setImages}
          />
        </div>
        <div style={{ display: currentStep === 3 ? 'block' : 'none' }}>
          <ContactLocationTab form={form} />
        </div>
        <div style={{ display: currentStep === 4 ? 'block' : 'none' }}>
          <OperatingHoursTab form={form} />
        </div>
        <div style={{ display: currentStep === 5 ? 'block' : 'none' }}>
          <SettingsTab form={form} />
        </div>
        <div style={{ display: currentStep === 6 ? 'block' : 'none' }}>
          <ServicesAndBreedsTab 
            serviceCategoryId={form.watch("service_category_id")}
            onServicesChange={setServices}
            onBreedsChange={setSelectedBreeds}
          />
        </div>
      </>
    )
  }

  const isLastStep = currentStep === WIZARD_STEPS.length

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={handleCancel}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Service Providers
        </Button>
        
        <h1 className="text-3xl font-bold">Add New Service Provider</h1>
        <p className="text-muted-foreground mt-2">
          Follow the steps below to create a new service provider profile.
        </p>
      </div>

      <WizardProgressBar
        currentStep={currentStep}
        totalSteps={WIZARD_STEPS.length}
        stepLabels={WIZARD_STEPS.map(step => step.label)}
      />

      <Card>
        <CardHeader>
          <CardTitle>{WIZARD_STEPS[currentStep - 1]?.label}</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <div className="space-y-6">
              {renderCurrentStep()}

              <div className="flex justify-between pt-6 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentStep === 1}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Previous
                </Button>

                <div className="space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                  >
                    Cancel
                  </Button>
                  
                  {isLastStep ? (
                    <Button 
                      type="button" 
                      onClick={() => form.handleSubmit(onSubmit, handleFormError)()} 
                      disabled={isLoading}
                    >
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create Provider
                    </Button>
                  ) : (
                    <Button type="button" onClick={handleNext}>
                      Next
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
