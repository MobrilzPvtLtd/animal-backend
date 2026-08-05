"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { PlacesAutocomplete } from "@/components/ui/places-autocomplete"
import { Loader2, MapPin } from "lucide-react"
import { toast } from "sonner"

interface ContactLocationTabProps {
  form: any
}

export function ContactLocationTab({ form }: ContactLocationTabProps) {
  const [isDetectingGps, setIsDetectingGps] = useState(false)

  const fallbackIpLocation = async () => {
    try {
      const response = await fetch("https://ipapi.co/json/")
      const data = await response.json()
      if (data && data.latitude && data.longitude) {
        const lat = data.latitude
        const lng = data.longitude
        const addressStr = [data.city, data.region, data.country_name].filter(Boolean).join(", ")
        
        form.setValue("latitude", lat.toString(), { shouldValidate: true, shouldDirty: true })
        form.setValue("longitude", lng.toString(), { shouldValidate: true, shouldDirty: true })
        form.setValue("address", addressStr || `Current Location (${lat}, ${lng})`, { shouldValidate: true, shouldDirty: true })
        
        toast.success("Location detected: " + (addressStr || "IP Position"))
        return true
      }
    } catch (err) {
      console.error("IP location fallback error:", err)
    }
    return false
  }

  const handleDetectGps = () => {
    setIsDetectingGps(true)
    toast.info("Detecting current location...")

    if (!("geolocation" in navigator)) {
      fallbackIpLocation().finally(() => setIsDetectingGps(false))
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude

        form.setValue("latitude", lat.toString(), { shouldValidate: true, shouldDirty: true })
        form.setValue("longitude", lng.toString(), { shouldValidate: true, shouldDirty: true })

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
          )
          const data = await response.json()
          
          if (data && data.display_name) {
            form.setValue("address", data.display_name, { shouldValidate: true, shouldDirty: true })
            toast.success("Location detected: " + data.display_name.split(',').slice(0, 3).join(','))
          } else {
            const fallbackAddr = `Current Location (${lat.toFixed(5)}, ${lng.toFixed(5)})`
            form.setValue("address", fallbackAddr, { shouldValidate: true, shouldDirty: true })
            toast.success(`Captured location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`)
          }
        } catch {
          const fallbackAddr = `Current Location (${lat.toFixed(5)}, ${lng.toFixed(5)})`
          form.setValue("address", fallbackAddr, { shouldValidate: true, shouldDirty: true })
          toast.success(`Captured location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`)
        } finally {
          setIsDetectingGps(false)
        }
      },
      async (error) => {
        console.warn("Browser GPS failed/timed out, attempting IP Geolocation fallback...", error)
        if (error.code === error.PERMISSION_DENIED) {
          toast.error("Location permission denied. Trying IP location...")
        }
        const ok = await fallbackIpLocation()
        if (!ok && error.code !== error.PERMISSION_DENIED) {
          toast.error("Failed to detect location: " + error.message)
        }
        setIsDetectingGps(false)
      },
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 }
    )
  }

  return (
    <div className="space-y-4">
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

      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">Location</h3>
          <button
            type="button"
            disabled={isDetectingGps}
            onClick={handleDetectGps}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-md transition-all border border-primary/20 shadow-sm disabled:opacity-50"
          >
            {isDetectingGps ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Detecting GPS Location...</span>
              </>
            ) : (
              <>
                <MapPin className="h-3.5 w-3.5" />
                <span>📍 Use Current Location (GPS)</span>
              </>
            )}
          </button>
        </div>
        
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
              description="Enter address or use Current Location button above to auto-detect GPS position."
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
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
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
    </div>
  )
}
