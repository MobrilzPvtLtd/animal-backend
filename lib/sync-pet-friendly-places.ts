import { supabase } from "@/lib/supabase"

export async function syncServiceProviderToPetFriendlyPlace(
  serviceProviderId: number,
  providerData: {
    name: string
    description?: string | null
    bio?: string | null
    image_url?: string | null
    images?: string[] | null
    phone?: string | null
    emergency_number?: string | null
    email?: string | null
    website?: string | null
    location_id?: number | null
    address?: string | null
    latitude?: string | number | null
    longitude?: string | number | null
    operating_hours?: any
    rating?: number | null
    is_verified?: boolean
    is_deleted?: boolean
  },
  petFriendlyInfo: {
    is_pet_friendly_place?: boolean
    pet_friendly_name?: string | null
    pet_friendly_group_id?: number | null
    pet_friendly_group_ids?: number[] | null
    amenities?: string[] | null
  },
  customClient?: any
) {
  const client = customClient || supabase

  try {
    // Check if pet_friendly_place already exists for this service_provider_id
    const { data: existingPlaces, error: searchError } = await client
      .from("pet_friendly_places")
      .select("pet_friendly_place_id")
      .eq("service_provider_id", serviceProviderId)
      .limit(1)

    if (searchError) {
      console.error("Error searching pet_friendly_places:", searchError)
    }

    const existingPlaceId = existingPlaces && existingPlaces.length > 0 ? existingPlaces[0].pet_friendly_place_id : null

    // If checkbox is NOT checked / false:
    if (petFriendlyInfo.is_pet_friendly_place === false) {
      if (existingPlaceId) {
        // Mark as deleted so it is hidden from Pet Friendly Places view
        await client
          .from("pet_friendly_places")
          .update({ is_deleted: true, show_publicly: false })
          .eq("pet_friendly_place_id", existingPlaceId)
      }
      return
    }

    let address = providerData.address || null
    let latitude = providerData.latitude ? String(providerData.latitude) : null
    let longitude = providerData.longitude ? String(providerData.longitude) : null

    // If location_id is provided, resolve address/lat/lng from locations table
    if (providerData.location_id && (!address || !latitude || !longitude)) {
      const { data: loc } = await client
        .from("locations")
        .select("*")
        .eq("location_id", providerData.location_id)
        .maybeSingle()

      if (loc) {
        address = address || loc.address || loc.formatted_address || loc.name || null
        latitude = latitude || (loc.latitude ? String(loc.latitude) : null)
        longitude = longitude || (loc.longitude ? String(loc.longitude) : null)
      }
    }

    const placePayload = {
      name: petFriendlyInfo.pet_friendly_name?.trim() || providerData.name,
      description: providerData.description || providerData.bio || null,
      image_url: providerData.image_url || null,
      images: providerData.images || (providerData.image_url ? [providerData.image_url] : []),
      phone: providerData.phone || providerData.emergency_number || null,
      email: providerData.email || null,
      website: providerData.website || null,
      address: address,
      latitude: latitude,
      longitude: longitude,
      operating_hours: providerData.operating_hours || null,
      amenities: petFriendlyInfo.amenities || [],
      rating: providerData.rating ?? 0,
      service_provider_id: serviceProviderId,
      is_verified: providerData.is_verified ?? false,
      is_deleted: providerData.is_deleted ?? false,
      show_publicly: true,
    }

    let placeId = existingPlaceId

    if (existingPlaceId) {
      const { error: updateErr } = await client
        .from("pet_friendly_places")
        .update(placePayload)
        .eq("pet_friendly_place_id", existingPlaceId)

      if (updateErr) {
        console.error("Error updating pet_friendly_places:", updateErr)
      }
    } else {
      const { data: newPlace, error: insertErr } = await client
        .from("pet_friendly_places")
        .insert([placePayload])
        .select("pet_friendly_place_id")
        .single()

      if (insertErr) {
        console.error("Error inserting pet_friendly_places:", insertErr)
      } else if (newPlace) {
        placeId = newPlace.pet_friendly_place_id
      }
    }

    // Sync group mapping if pet_friendly_group_id or pet_friendly_group_ids specified
    const groupIds: number[] = petFriendlyInfo.pet_friendly_group_ids && petFriendlyInfo.pet_friendly_group_ids.length > 0
      ? petFriendlyInfo.pet_friendly_group_ids
      : (petFriendlyInfo.pet_friendly_group_id ? [petFriendlyInfo.pet_friendly_group_id] : []);

    if (placeId && groupIds.length > 0) {
      await client
        .from("place_groups")
        .delete()
        .eq("place_id", placeId)

      const groupRows = groupIds.map(gId => ({
        place_id: placeId,
        group_id: gId,
      }))

      await client
        .from("place_groups")
        .insert(groupRows)
    }
  } catch (err) {
    console.error("Error syncing ServiceProvider to pet_friendly_places:", err)
  }
}
