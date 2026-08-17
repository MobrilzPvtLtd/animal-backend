import { z } from "zod"

export const serviceProviderSchema = z.object({
  service_category_id: z.number().optional(),
  category_ids: z.array(z.number()).optional(),
  name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }),
  description: z.string().optional(),
  bio: z.string().optional(),
  image_url: z.string().optional(),
  phone: z.string().optional(),
  emergency_number: z.string().optional(),
  number_2: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
  location_id: z.number().optional(),
  is_verified: z.boolean().default(false),
  is_active: z.boolean().default(true),
  featured: z.boolean().default(false),
  operating_hours: z.record(z.any()).optional().nullable(),
  social_media: z.record(z.any()).optional(),
  additional_info: z.record(z.any()).optional(),
  service_areas: z.string().optional(),
  show_operating_hours: z.boolean().optional().default(false),
  // Location fields for creating a new location
  address: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  show_publicly: z.boolean().default(true),
})

export type ServiceProvider = z.infer<typeof serviceProviderSchema> & {
  service_provider_id: number
  rating: number
  total_reviews: number
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
  service_category?: {
    service_category_id: number
    name: string
    description: string | null
    icon: string | null
    color: string | null
    is_active: boolean
    sort_order: number
    created_at: string
  }
  services?: Service[]
  tags?: ServiceProviderTag[]
}

export type Service = {
  service_id: number
  service_provider_id: number
  name: string
  description: string | null
  price: number | null
  duration_minutes: number | null
  is_active: boolean
  additional_info: any
  created_at: string
}

export type ServiceProviderTag = {
  service_provider_tag_id: number
  service_provider_id: number
  tag_name: string
  created_at: string
}
