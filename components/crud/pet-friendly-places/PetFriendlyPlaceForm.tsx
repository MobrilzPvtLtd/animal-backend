"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { PetFriendlyPlace, petFriendlyPlaceSchema } from "./schema"
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
import { Switch } from "@/components/ui/switch"
import { MultipleImageUpload, ServiceProviderImage } from "@/components/ui/multiple-image-upload"
import { Loader2, X, Plus, Building2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { validatePetFriendlyPlaceName } from "@/lib/name-validation"
import { PlacesAutocomplete } from "@/components/ui/places-autocomplete"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { OperatingHoursTab } from "@/components/crud/service-providers/OperatingHoursTab"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface PetFriendlyPlaceFormProps {
  place?: PetFriendlyPlace
  onSuccess: () => void
  onCancel: () => void
}

const DEFAULT_OPERATING_HOURS = {
  monday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
  tuesday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
  wednesday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
  thursday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
  friday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
  saturday: { isOpen: false, openTime: "09:00", closeTime: "17:00" },
  sunday: { isOpen: false, openTime: "09:00", closeTime: "17:00" }
}

export function PetFriendlyPlaceForm({ place, onSuccess, onCancel }: PetFriendlyPlaceFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [amenityInput, setAmenityInput] = useState("")
  const [groups, setGroups] = useState<any[]>([])
  const [fetchingGroups, setFetchingGroups] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState<number | undefined>(
    (place as any)?.place_groups?.[0]?.group_id || (place as any)?.group_id || undefined
  )
  const isEditing = !!place

  // Quick Group Creation State
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false)
  const [newGroupName, setNewGroupName] = useState("")
  const [newGroupDesc, setNewGroupDesc] = useState("")
  const [isSavingGroup, setIsSavingGroup] = useState(false)

  const form = useForm<PetFriendlyPlace>({
    resolver: zodResolver(petFriendlyPlaceSchema),
    defaultValues: place ? {
      name: place.name,
      description: place.description || "",
      image_url: place.image_url || "",
      images: (place as any).images || (place.image_url ? [place.image_url] : []),
      phone: place.phone || "",
      email: (place as any).email || "",
      website: (place as any).website || "",
      rating: place.rating || 0,
      is_verified: (place as any).is_verified ?? false,
      address: place.address || "",
      latitude: place.latitude ? place.latitude.toString() : "",
      longitude: place.longitude ? place.longitude.toString() : "",
      show_publicly: place.show_publicly ?? true,
      operating_hours: (place as any).operating_hours || DEFAULT_OPERATING_HOURS,
      amenities: (place as any).amenities || [],
      pet_policy: (place as any).pet_policy || "",
    } : {
      name: "",
      description: "",
      image_url: "",
      images: [],
      phone: "",
      email: "",
      website: "",
      rating: 0,
      is_verified: false,
      address: "",
      latitude: "",
      longitude: "",
      show_publicly: true,
      operating_hours: DEFAULT_OPERATING_HOURS,
      amenities: [],
      pet_policy: "",
    }
  })

  // Fetch linked group if editing
  useEffect(() => {
    async function loadPlaceGroup() {
      if (place?.pet_friendly_place_id) {
        const { data } = await supabase
          .from("place_groups")
          .select("group_id")
          .eq("place_id", place.pet_friendly_place_id)
          .maybeSingle()
        if (data?.group_id) {
          setSelectedGroupId(data.group_id)
        }
      }
    }
    loadPlaceGroup()
  }, [place])

  // Load groups from `groups` table
  useEffect(() => {
    async function loadGroups() {
      setFetchingGroups(true)
      try {
        const { data, error } = await supabase
          .from("groups")
          .select("*")
          .eq("is_active", true)
          .order("name")
        if (data) setGroups(data)
      } catch (err) {
        console.error("Error loading place groups:", err)
      } finally {
        setFetchingGroups(false)
      }
    }
    loadGroups()
  }, [])

  // Create new Group in `groups` table
  const handleCreateNewGroup = async () => {
    if (!newGroupName.trim()) {
      toast.error("Group name is required")
      return
    }

    setIsSavingGroup(true)
    try {
      const { data: newGroup, error } = await supabase
        .from("groups")
        .insert({
          name: newGroupName.trim(),
          description: newGroupDesc.trim() || null,
          is_active: true,
        })
        .select("*")
        .single()

      if (error) throw error

      setGroups((prev) => [newGroup, ...prev])
      setSelectedGroupId(newGroup.group_id)
      toast.success(`Group "${newGroup.name}" created and selected!`)

      // Reset mini form
      setNewGroupName("")
      setNewGroupDesc("")
      setIsQuickCreateOpen(false)
    } catch (err: any) {
      console.error("Error creating group:", err)
      toast.error(err?.message || "Failed to create group")
    } finally {
      setIsSavingGroup(false)
    }
  }

  const handleGroupSelect = (groupIdStr: string) => {
    if (!groupIdStr || groupIdStr === "none") {
      setSelectedGroupId(undefined)
      return
    }

    const groupId = Number(groupIdStr)
    const selected = groups.find((g) => g.group_id === groupId)
    if (!selected) return

    setSelectedGroupId(groupId)
    toast.success(`Selected parent group "${selected.name}"`)
  }

  async function onSubmit(data: PetFriendlyPlace) {
    setIsLoading(true)
    try {
      const { isUnique, error: validationError } = await validatePetFriendlyPlaceName(
        data.name,
        isEditing ? place.pet_friendly_place_id : undefined
      );

      if (validationError) {
        toast.error(validationError);
        setIsLoading(false);
        return;
      }

      if (!isUnique) {
        form.setError("name", {
          type: "manual",
          message: "A pet friendly place with this name already exists"
        });
        setIsLoading(false);
        return;
      }

      // Defensively extract system columns + joined objects
      const { 
        location, 
        location_id,
        pet_friendly_place_id,
        created_at,
        updated_at,
        views,
        is_deleted,
        place_groups,
        service_provider,
        ...cleanPlaceData 
      } = data as any;

      const imagesList = data.images && data.images.length > 0 ? data.images : (data.image_url ? [data.image_url] : []);
      const payload = {
        ...cleanPlaceData,
        image_url: imagesList[0] || null,
        images: imagesList,
        address: data.address || null,
        latitude: data.latitude ? parseFloat(data.latitude.toString()) : null,
        longitude: data.longitude ? parseFloat(data.longitude.toString()) : null,
        show_publicly: data.show_publicly ?? true,
      };

      // Ensure operating_hours defaults if not set
      if (!payload.operating_hours) {
        payload.operating_hours = DEFAULT_OPERATING_HOURS
      }

      let savedPlaceId: number | undefined

      if (isEditing) {
        savedPlaceId = place.pet_friendly_place_id
        const { error } = await supabase
          .from("pet_friendly_places")
          .update(payload)
          .eq("pet_friendly_place_id", savedPlaceId)

        if (error) throw error
        toast.success("Pet friendly place updated successfully")
      } else {
        const { data: newPlace, error } = await supabase
          .from("pet_friendly_places")
          .insert(payload)
          .select("pet_friendly_place_id")
          .single()

        if (error) throw error
        savedPlaceId = newPlace.pet_friendly_place_id
        toast.success("Pet friendly place created successfully")
      }

      // Save Group mapping in `place_groups` table
      if (savedPlaceId) {
        await supabase
          .from("place_groups")
          .delete()
          .eq("place_id", savedPlaceId)

        if (selectedGroupId) {
          await supabase
            .from("place_groups")
            .insert({
              place_id: savedPlaceId,
              group_id: selectedGroupId,
            })
        }
      }

      onSuccess()
    } catch (error: any) {
      console.error("Error saving pet friendly place:", error)
      toast.error(error?.message || "Failed to save pet friendly place")
    } finally {
      setIsLoading(false)
    }
  }

  const onInvalid = (errors: any) => {
    console.error("Form validation errors:", errors);
    const firstKey = Object.keys(errors)[0];
    if (firstKey) {
      const errMsg = errors[firstKey]?.message || `Please check the ${firstKey} field`;
      toast.error(`Validation Error (${firstKey}): ${errMsg}`);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-6">
        {/* Parent Group Selection Card */}
        <div className="p-4 border rounded-xl bg-gradient-to-r from-muted/50 to-muted/20 space-y-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <label className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
              <Building2 className="h-4 w-4 text-primary" />
              <span>Parent Group</span>
            </label>
            <div className="flex items-center gap-2">
              {fetchingGroups && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1 border-primary/40 text-primary hover:bg-primary/10"
                onClick={() => setIsQuickCreateOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create New Group</span>
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Group multiple places under a single Group (using <code>groups</code> & <code>place_groups</code> tables). Select an existing Group or create a new one.
          </p>
          <Select
            value={selectedGroupId?.toString() || "none"}
            onValueChange={handleGroupSelect}
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Select a Group..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">-- Standalone Place (No Group) --</SelectItem>
              {groups.map((g) => (
                <SelectItem key={g.group_id} value={g.group_id.toString()}>
                  🏢 {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Quick Create Group Dialog */}
        <Dialog open={isQuickCreateOpen} onOpenChange={setIsQuickCreateOpen}>
          <DialogContent className="sm:max-w-[450px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <span>Create New Group</span>
              </DialogTitle>
              <DialogDescription>
                Add a new Parent Group to <code>groups</code> table. Once created, you can add multiple branch places under it.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Group Name *</label>
                <Input
                  placeholder="e.g. Bark & Bite Group"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description (Optional)</label>
                <Textarea
                  placeholder="Brief description of the group"
                  className="resize-none"
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsQuickCreateOpen(false)}
                disabled={isSavingGroup}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleCreateNewGroup}
                disabled={isSavingGroup}
              >
                {isSavingGroup && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create & Select Group
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter place name" {...field} />
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
                  placeholder="Enter place description"
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
          name="images"
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
                  folder="pet-friendly-places"
                  label="Place Images"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Location Section */}
        <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
          <h3 className="font-semibold text-sm">Location Details</h3>
          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address</FormLabel>
                <FormControl>
                  <PlacesAutocomplete
                    value={field.value || ""}
                    onChange={(address: string, lat: number, lng: number) => {
                      field.onChange(address);
                      if (lat) form.setValue("latitude", lat.toString());
                      if (lng) form.setValue("longitude", lng.toString());
                    }}
                    placeholder="Search address or type location..."
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="latitude"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Latitude</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. 28.6139" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="longitude"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Longitude</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. 77.2090" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="show_publicly"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Show Location Publicly</FormLabel>
                  <FormDescription>
                    Display address and map coordinates on the public listing.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        {/* Contact Info */}
        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input placeholder="Phone number" {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="Email address" type="email" {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="website"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Website</FormLabel>
                <FormControl>
                  <Input placeholder="https://..." {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Pet Policy */}
        <FormField
          control={form.control}
          name="pet_policy"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Pet Policy</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Dogs allowed indoors, leash required" {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Amenities Section */}
        <div className="space-y-3">
          <FormLabel>Amenities</FormLabel>
          <div className="flex gap-2">
            <Input
              placeholder="Add amenity (e.g. WiFi, Water Bowl, Outdoor Seating)..."
              value={amenityInput}
              onChange={(e) => setAmenityInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  if (amenityInput.trim()) {
                    const current = form.getValues("amenities") || []
                    if (!current.includes(amenityInput.trim())) {
                      form.setValue("amenities", [...current, amenityInput.trim()])
                    }
                    setAmenityInput("")
                  }
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (amenityInput.trim()) {
                  const current = form.getValues("amenities") || []
                  if (!current.includes(amenityInput.trim())) {
                    form.setValue("amenities", [...current, amenityInput.trim()])
                  }
                  setAmenityInput("")
                }
              }}
            >
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {(form.watch("amenities") || []).map((amenity: string, idx: number) => (
              <Badge key={idx} variant="secondary" className="px-3 py-1 text-sm flex items-center gap-1.5">
                <span>{amenity}</span>
                <button
                  type="button"
                  onClick={() => {
                    const current = form.getValues("amenities") || []
                    form.setValue("amenities", current.filter((_, i) => i !== idx))
                  }}
                  className="hover:text-destructive text-muted-foreground transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>

        {/* Operating Hours */}
        <div className="space-y-2 border rounded-lg p-4 bg-muted/20">
          <FormLabel className="text-base font-semibold">Operating Hours</FormLabel>
          <OperatingHoursTab form={form} />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="button" onClick={() => form.handleSubmit(onSubmit, onInvalid)()} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Update Place" : "Create Place"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
