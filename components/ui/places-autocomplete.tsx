"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, MapPin, Navigation } from "lucide-react"
import { FormControl, FormDescription, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface PlacesAutocompleteProps {
  value?: string
  onChange: (address: string, lat: number, lng: number) => void
  placeholder?: string
  label?: string
  description?: string
  error?: string
  showCurrentLocationButton?: boolean
}

declare global {
  interface Window {
    google?: any
  }
}

let googleMapsScriptPromise: Promise<void> | null = null

function loadGoogleMapsScript(apiKey: string) {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser"))
  }

  if (window.google?.maps?.places) {
    return Promise.resolve()
  }

  if (googleMapsScriptPromise) {
    return googleMapsScriptPromise
  }

  googleMapsScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById("google-maps-places-script")

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true })
      existingScript.addEventListener("error", () => reject(new Error("Failed to load Google Maps script")), { once: true })
      return
    }

    const script = document.createElement("script")
    script.id = "google-maps-places-script"
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Failed to load Google Maps script"))
    document.head.appendChild(script)
  })

  return googleMapsScriptPromise
}

export function PlacesAutocomplete({
  value = "",
  onChange,
  placeholder = "Enter address or location...",
  label,
  description,
  error,
  showCurrentLocationButton = true,
}: PlacesAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value)
  const [isLoading, setIsLoading] = useState(false)
  const [isDetectingGps, setIsDetectingGps] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [loadError, setLoadError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<any>(null)
  const onChangeRef = useRef(onChange)
  const lastKnownLatLng = useRef({ lat: 0, lng: 0 })

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  useEffect(() => {
    setInputValue(value)
  }, [value])

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!apiKey) {
      setLoadError("Google Maps API key is not available for the browser.")
      return
    }

    let cancelled = false

    const initializeAutocomplete = async () => {
      setIsLoading(true)

      try {
        await loadGoogleMapsScript(apiKey)

        if (cancelled || !inputRef.current || !window.google?.maps?.places) {
          return
        }

        autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
          fields: ["formatted_address", "geometry", "address_components", "name"],
        })

        autocompleteRef.current.addListener("place_changed", () => {
          const place = autocompleteRef.current?.getPlace()

          if (!place?.geometry?.location) {
            return
          }

          const formattedAddress = place.formatted_address || place.name || inputRef.current?.value || ""
          const location = place.geometry.location
          const lat = location.lat()
          const lng = location.lng()

          lastKnownLatLng.current = { lat, lng }
          setInputValue(formattedAddress)
          onChangeRef.current(formattedAddress, lat, lng)
        })

        setIsReady(true)
        setLoadError("")
      } catch (error) {
        console.error("Google Maps autocomplete load error:", error)
        setLoadError("Unable to load Google Maps suggestions.")
      } finally {
        setIsLoading(false)
      }
    }

    initializeAutocomplete()

    return () => {
      cancelled = true
    }
  }, [apiKey])

  const reverseGeocodeGoogle = async (lat: number, lng: number): Promise<string> => {
    if (window.google?.maps?.Geocoder) {
      return new Promise((resolve) => {
        const geocoder = new window.google.maps.Geocoder()
        geocoder.geocode({ location: { lat, lng } }, (results: any[], status: string) => {
          if (status === "OK" && results && results[0]) {
            resolve(results[0].formatted_address)
          } else {
            resolve("")
          }
        })
      })
    }

    if (apiKey) {
      try {
        const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`)
        const data = await res.json()
        if (data.status === "OK" && data.results?.[0]?.formatted_address) {
          return data.results[0].formatted_address
        }
      } catch (e) {
        console.warn("Google Geocoding API fetch error:", e)
      }
    }

    return ""
  }

  const handleDetectCurrentLocation = () => {
    setIsDetectingGps(true)
    toast.info("Detecting current GPS location...")

    const handleSuccess = async (lat: number, lng: number) => {
      lastKnownLatLng.current = { lat, lng }
      
      const googleAddress = await reverseGeocodeGoogle(lat, lng)
      const finalAddress = googleAddress || `Current Location (${lat.toFixed(5)}, ${lng.toFixed(5)})`

      setInputValue(finalAddress)
      onChangeRef.current(finalAddress, lat, lng)
      setIsDetectingGps(false)
      toast.success("Location set: " + (googleAddress.split(',').slice(0, 3).join(',') || `${lat.toFixed(4)}, ${lng.toFixed(4)}`))
    }

    if (!("geolocation" in navigator)) {
      fetchIpLocation()
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        handleSuccess(position.coords.latitude, position.coords.longitude)
      },
      (err) => {
        console.warn("Browser GPS permission denied or failed, fallback to IP:", err)
        fetchIpLocation()
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    )
  }

  const fetchIpLocation = async () => {
    try {
      const response = await fetch("https://ipapi.co/json/")
      const data = await response.json()
      if (data && data.latitude && data.longitude) {
        const lat = data.latitude
        const lng = data.longitude
        lastKnownLatLng.current = { lat, lng }
        const cityStr = [data.city, data.region, data.country_name].filter(Boolean).join(", ")
        const finalAddress = cityStr || `Current Location (${lat}, ${lng})`

        setInputValue(finalAddress)
        onChangeRef.current(finalAddress, lat, lng)
        toast.success("Location detected via IP: " + finalAddress)
      } else {
        toast.error("Could not detect location automatically.")
      }
    } catch {
      toast.error("Failed to detect location.")
    } finally {
      setIsDetectingGps(false)
    }
  }

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value
    setInputValue(nextValue)

    if (!nextValue) {
      lastKnownLatLng.current = { lat: 0, lng: 0 }
      onChangeRef.current("", 0, 0)
    }
  }

  const handleBlur = () => {
    if (inputValue !== value) {
      onChangeRef.current(
        inputValue,
        lastKnownLatLng.current.lat,
        lastKnownLatLng.current.lng
      )
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
    }
  }

  const inputField = (
    <div className="space-y-2">
      <div className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="pr-10"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <MapPin className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>

        {showCurrentLocationButton && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDetectCurrentLocation}
            disabled={isDetectingGps}
            className="gap-1.5 whitespace-nowrap text-xs h-10 px-3 shrink-0 border-primary/30 text-primary hover:bg-primary/10"
            title="Detect and use current GPS location"
          >
            {isDetectingGps ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <MapPin className="h-3.5 w-3.5 text-primary" />
            )}
            <span>Use Current Location</span>
          </Button>
        )}
      </div>
      {loadError && <p className="text-sm text-destructive">{loadError}</p>}
      {isReady && !loadError && (
        <p className="text-xs text-muted-foreground">
          Search address from Google Maps or click <strong>Current Location</strong> to auto-detect.
        </p>
      )}
    </div>
  )

  if (label) {
    return (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <FormControl>{inputField}</FormControl>
        {description && <FormDescription>{description}</FormDescription>}
        {error && <FormMessage>{error}</FormMessage>}
      </FormItem>
    )
  }

  return inputField
}