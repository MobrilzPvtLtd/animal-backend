import { z } from "zod"

const dayHoursSchema = z.object({
  isOpen: z.boolean(),
  openTime: z.string(),
  closeTime: z.string()
}).optional()

// Schema for the pet friendly place form
export const petFriendlyPlaceSchema = z.object({
  name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }),
  description: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().optional().or(z.literal("")).or(z.null()),
  website: z.string().url().optional().or(z.literal("")).or(z.null()),
  rating: z.number().min(0).max(5).nullable().optional(),
  is_verified: z.boolean().default(false),
  location_id: z.number().nullable().optional(),
  operating_hours: z.object({
    monday: dayHoursSchema,
    tuesday: dayHoursSchema,
    wednesday: dayHoursSchema,
    thursday: dayHoursSchema,
    friday: dayHoursSchema,
    saturday: dayHoursSchema,
    sunday: dayHoursSchema
  }).nullable().optional(),
  amenities: z.array(z.string()).nullable().optional(),
  pet_policy: z.string().nullable().optional(),
  // Location fields for creating a new location
  address: z.string().nullable().optional(),
  latitude: z.string().nullable().optional(),
  longitude: z.string().nullable().optional(),
  service_provider_id: z.number().nullable().optional(),
  show_publicly: z.boolean().default(true),
})

export type PetFriendlyPlace = z.infer<typeof petFriendlyPlaceSchema> & {
  pet_friendly_place_id: number
  views: number
  is_deleted: boolean
  created_at: string
  updated_at: string
  location?: {
    location_id: number
    address: string
    latitude: string
    longitude: string
    show_publicly: boolean
  } | null
}
