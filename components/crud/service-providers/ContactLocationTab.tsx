"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PlacesAutocomplete } from "@/components/ui/places-autocomplete"
import { Loader2, MapPin, Plus, X, Building2, PawPrint, Pencil } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"

interface ContactLocationTabProps {
  form: any
}

export function ContactLocationTab({ form }: ContactLocationTabProps) {
  // Pet-Friendly Place specific state
  const isPetFriendlyChecked = form.watch("is_pet_friendly_place")
  const amenitiesList = form.watch("amenities") || []
  const [amenityInput, setAmenityInput] = useState("")
  const [groups, setGroups] = useState<any[]>([])
  const [fetchingGroups, setFetchingGroups] = useState(false)

  // Quick Group Creation state
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false)
  const [newGroupName, setNewGroupName] = useState("")
  const [newGroupDesc, setNewGroupDesc] = useState("")
  const [isSavingGroup, setIsSavingGroup] = useState(false)

  // Group Edit state
  const [isEditGroupOpen, setIsEditGroupOpen] = useState(false)
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null)
  const [editGroupName, setEditGroupName] = useState("")
  const [editGroupDesc, setEditGroupDesc] = useState("")
  const [isUpdatingGroup, setIsUpdatingGroup] = useState(false)

  // Load groups from database
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
        console.error("Error loading groups:", err)
      } finally {
        setFetchingGroups(false)
      }
    }
    loadGroups()
  }, [])

  const handleAddAmenity = () => {
    if (!amenityInput.trim()) return
    const current = form.getValues("amenities") || []
    if (!current.includes(amenityInput.trim())) {
      form.setValue("amenities", [...current, amenityInput.trim()], { shouldDirty: true, shouldValidate: true })
    }
    setAmenityInput("")
  }

  const handleRemoveAmenity = (indexToRemove: number) => {
    const current = form.getValues("amenities") || []
    form.setValue(
      "amenities",
      current.filter((_: string, index: number) => index !== indexToRemove),
      { shouldDirty: true, shouldValidate: true }
    )
  }

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
      form.setValue("pet_friendly_group_id", newGroup.group_id, { shouldDirty: true, shouldValidate: true })
      toast.success(`Group "${newGroup.name}" created and selected!`)

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

  const handleOpenEditGroup = () => {
    const selectedId = form.getValues("pet_friendly_group_id")
    if (!selectedId) return
    const grp = groups.find(g => g.group_id === Number(selectedId))
    if (grp) {
      setEditingGroupId(grp.group_id)
      setEditGroupName(grp.name || "")
      setEditGroupDesc(grp.description || "")
      setIsEditGroupOpen(true)
    }
  }

  const handleSaveEditGroup = async () => {
    if (!editingGroupId || !editGroupName.trim()) {
      toast.error("Group name is required")
      return
    }
    setIsUpdatingGroup(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token

      const res = await fetch(`/api/v1/groups?group_id=${editingGroupId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { "Authorization": `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          name: editGroupName.trim(),
          description: editGroupDesc.trim() || null,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to update group")
      }

      const { group: updatedGroup } = await res.json()
      setGroups(prev => prev.map(g => g.group_id === editingGroupId ? updatedGroup : g))
      setIsEditGroupOpen(false)
      toast.success(`Group "${updatedGroup.name}" updated successfully!`)
    } catch (err: any) {
      console.error("Error updating group:", err)
      toast.error(err.message || "Failed to update group")
    } finally {
      setIsUpdatingGroup(false)
    }
  }

  return (
    <div className="space-y-6">
      <FormField
        control={form.control}
        name="phone"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Phone</FormLabel>
            <FormControl>
              <Input placeholder="Phone number" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="emergency_number"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Emergency Number</FormLabel>
            <FormControl>
              <Input placeholder="Emergency contact number" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="number_2"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Secondary Number</FormLabel>
            <FormControl>
              <Input placeholder="Additional contact number" {...field} />
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
              <Input placeholder="email@example.com" type="email" {...field} />
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
              <Input placeholder="https://example.com" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* 🐾 PET-FRIENDLY PLACE INTEGRATION CHECKBOX & EXPANDABLE SECTION 🐾 */}
      <div className="border-t border-b py-5 my-2 space-y-4">
        <FormField
          control={form.control}
          name="is_pet_friendly_place"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <PawPrint className="h-5 w-5 text-amber-600" />
                  <FormLabel className="text-base font-semibold text-amber-900 cursor-pointer">
                    Feature as Pet-Friendly Place on Home Page
                  </FormLabel>
                </div>
                <FormDescription className="text-amber-800/80 text-xs">
                  Tick this box if this place should appear in the "Pet-Friendly Places" Quick View section on the mobile app home screen.
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value || false}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Expandable Pet-Friendly Fields */}
        {isPetFriendlyChecked && (
          <Card className="border-amber-300/60 bg-amber-50/20 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
            <CardContent className="pt-5 space-y-5">
              {/* Pet-Friendly Group Selector */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <FormLabel className="font-semibold text-sm">
                    Pet-Friendly Group / Category <span className="text-destructive">*</span>
                  </FormLabel>
                  <div className="flex items-center gap-2">
                    {form.watch("pet_friendly_group_id") && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1 border-amber-300 text-amber-800 hover:bg-amber-100"
                        onClick={handleOpenEditGroup}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit Group
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1 border-amber-300 text-amber-800 hover:bg-amber-100"
                      onClick={() => setIsQuickCreateOpen(true)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Quick Add Group
                    </Button>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="pet_friendly_group_id"
                  render={({ field }) => (
                    <FormItem>
                      <Select
                        disabled={fetchingGroups}
                        value={field.value ? String(field.value) : ""}
                        onValueChange={(val) => field.onChange(val ? Number(val) : null)}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder={fetchingGroups ? "Loading groups..." : "Select Pet-Friendly Group (e.g. Pet Friendly Restaurants, Pet Dining)"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {groups.map((group) => (
                            <SelectItem key={group.group_id} value={String(group.group_id)}>
                              {group.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription className="text-xs">
                        Places added under this group will automatically show in the mobile app's Pet-Friendly Places section.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Pet-Friendly Place Name Field */}
              <FormField
                control={form.control}
                name="pet_friendly_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-sm">Pet-Friendly Place Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., The Barking Dog Cafe (leave blank to use provider name)"
                        className="bg-white"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Enter a specific place name if you want it to appear differently from the Service Provider's main name.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Amenities Field */}
              <div className="space-y-2">
                <FormLabel className="font-semibold text-sm">Amenities & Features</FormLabel>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g., Outdoor Seating, Leash Hooks, Pet Menu, Parking"
                    value={amenityInput}
                    onChange={(e) => setAmenityInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        handleAddAmenity()
                      }
                    }}
                    className="bg-white"
                  />
                  <Button type="button" onClick={handleAddAmenity} variant="secondary">
                    Add
                  </Button>
                </div>

                {amenitiesList.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {amenitiesList.map((amenity: string, index: number) => (
                      <Badge key={index} variant="secondary" className="gap-1 bg-white border border-amber-200 px-2.5 py-1 text-xs">
                        {amenity}
                        <X
                          className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-destructive transition-colors"
                          onClick={() => handleRemoveAmenity(index)}
                        />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* LOCATION SECTION */}
      <div className="pt-2">
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <PlacesAutocomplete
              value={field.value || ""}
              onChange={(address: string, lat: number, lng: number) => {
                field.onChange(address)
                form.setValue("latitude", lat.toString())
                form.setValue("longitude", lng.toString())
              }}
              label="Address"
              placeholder="Start typing an address..."
              error={form.formState.errors.address?.message}
            />
          )}
        />

        <FormField
          control={form.control}
          name="service_areas"
          render={({ field }) => (
            <FormItem className="mt-4">
              <FormLabel>Service Areas / Coverage Regions</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., Central London, Westminster, Camden, Kensington"
                  {...field}
                  value={field.value || ""}
                />
              </FormControl>
              <FormDescription>
                Specify cities, postcodes, or regions covered by this provider (e.g. for mobile groomers or vets).
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="show_publicly"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 mt-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Show Location Publicly</FormLabel>
                <FormDescription>
                  Whether the location should be visible to users
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

      {/* QUICK GROUP CREATION DIALOG */}
      <Dialog open={isQuickCreateOpen} onOpenChange={setIsQuickCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Create Pet-Friendly Group
            </DialogTitle>
            <DialogDescription>
              Add a new group (e.g. "Pet Friendly Restaurants", "Pet Dining", "Pet Cafes") to organize pet friendly places.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <FormLabel className="text-sm font-medium">Group Name *</FormLabel>
              <Input
                placeholder="e.g. Pet Friendly Restaurants"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <FormLabel className="text-sm font-medium">Description (Optional)</FormLabel>
              <Textarea
                placeholder="Describe what kind of places belong to this group..."
                value={newGroupDesc}
                onChange={(e) => setNewGroupDesc(e.target.value)}
                className="resize-none h-20 text-sm"
              />
            </div>
          </div>

          <DialogFooter>
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
              disabled={isSavingGroup || !newGroupName.trim()}
            >
              {isSavingGroup ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create & Select"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Group Dialog */}
      <Dialog open={isEditGroupOpen} onOpenChange={setIsEditGroupOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <span>Edit Pet-Friendly Group</span>
            </DialogTitle>
            <DialogDescription>
              Update the name or description of this existing group.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <FormLabel className="text-sm font-medium">Group Name *</FormLabel>
              <Input
                placeholder="e.g. Pet Friendly Restaurants"
                value={editGroupName}
                onChange={(e) => setEditGroupName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <FormLabel className="text-sm font-medium">Description (Optional)</FormLabel>
              <Textarea
                placeholder="Describe what kind of places belong to this group..."
                value={editGroupDesc}
                onChange={(e) => setEditGroupDesc(e.target.value)}
                className="resize-none h-20 text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditGroupOpen(false)}
              disabled={isUpdatingGroup}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveEditGroup}
              disabled={isUpdatingGroup || !editGroupName.trim()}
            >
              {isUpdatingGroup ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
