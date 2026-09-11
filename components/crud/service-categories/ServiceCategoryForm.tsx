"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { supabase } from "@/lib/supabase"
import { serviceCategorySchema, ServiceCategory } from "./schema"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import Sketch from '@uiw/react-color-sketch'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { ImageUpload } from "@/components/ui/image-upload"

interface ServiceCategoryFormProps {
  category?: ServiceCategory
  onSuccess: () => void
  onCancel: () => void
}

export function ServiceCategoryForm({ category, onSuccess, onCancel }: ServiceCategoryFormProps) {
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm({
    resolver: zodResolver(serviceCategorySchema),
    defaultValues: {
      name: category?.name || "",
      description: category?.description || "",
      icon: category?.icon || "",
      image_url: category?.image_url || "",
      color: category?.color || "#3B82F6",
      is_active: category?.is_active ?? true,
      sort_order: category?.sort_order || 0,
    },
  })

  const onSubmit = async (values: any) => {
    setIsLoading(true)
    try {
      if (category) {
        // Update existing category
        const { error } = await supabase
          .from("service_categories")
          .update(values)
          .eq("service_category_id", category.service_category_id)

        if (error) throw error
        toast.success("Service category updated successfully")
      } else {
        // Create new category
        const { error } = await supabase
          .from("service_categories")
          .insert([values])

        if (error) throw error
        toast.success("Service category created successfully")
      }

      onSuccess()
    } catch (error) {
      console.error("Error saving service category:", error)
      toast.error("Failed to save service category")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter category name" {...field} />
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
                  placeholder="Enter category description"
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="image_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category Image</FormLabel>
              <FormControl>
                <ImageUpload
                  value={field.value || ""}
                  onChange={field.onChange}
                  folder="service-categories"
                  label="Category Image"
                  placeholder="Upload category image or paste URL"
                />
              </FormControl>
              <FormDescription>
                Upload an image to represent this category in the mobile app and admin dashboard (replaces emoji icon).
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="icon"
          render={({ field }) => {
            const PRESET_ICONS = ["🐶", "🐱", "🏥", "✂️", "🎓", "🏨", "🦴", "🚚", "🐴", "🐠", "🦜", "💉", "🐾", "🏠", "🛒", "🧼", "🩺", "🏬", "🏞️", "🚑", "🦮", "🐈", "🐎", "⭐"];
            return (
              <FormItem>
                <FormLabel>Icon</FormLabel>
                <FormControl>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5 p-2 border rounded-md bg-muted/30">
                      {PRESET_ICONS.map((iconStr) => (
                        <button
                          key={iconStr}
                          type="button"
                          onClick={() => field.onChange(iconStr)}
                          className={`h-8 w-8 rounded text-lg flex items-center justify-center transition-all ${field.value === iconStr
                            ? "bg-primary text-primary-foreground scale-110 shadow-sm"
                            : "bg-background hover:bg-muted border border-border"
                            }`}
                        >
                          {iconStr}
                        </button>
                      ))}
                    </div>
                    <Input placeholder="Or enter custom emoji or icon identifier" {...field} />
                  </div>
                </FormControl>
                <FormDescription>
                  Click a preset icon above or enter a custom emoji/icon identifier.
                </FormDescription>
                <FormMessage />
              </FormItem>
            );
          }}
        />

        <FormField
          control={form.control}
          name="color"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Color</FormLabel>
              <FormControl>
                <div className="w-full">
                  <Sketch
                    color={field.value}
                    disableAlpha={false}
                    onChange={(color) => {
                      field.onChange(color.hex)
                    }}
                    style={{ width: '100%' }}
                  />
                </div>
              </FormControl>
              <FormDescription>
                Choose a color for this category in the UI
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="sort_order"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sort Order</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="0"
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                />
              </FormControl>
              <FormDescription>
                Lower numbers appear first in lists
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="is_active"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Active</FormLabel>
                <FormDescription>
                  Whether this category is active and visible to users
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

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {category ? "Update" : "Create"} Category
          </Button>
        </div>
      </form>
    </Form>
  )
}
