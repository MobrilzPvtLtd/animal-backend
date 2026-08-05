"use client"

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"

interface BasicInfoTabProps {
  form: any
  categories: any[]
  hideCategorySelector?: boolean
  selectedCategoryName?: string
}

export function BasicInfoTab({ form, categories, hideCategorySelector, selectedCategoryName }: BasicInfoTabProps) {
  return (
    <div className="space-y-4">
      {!hideCategorySelector ? (
        <FormField
          control={form.control}
          name="category_ids"
          render={({ field }) => {
            const currentCategoryIds: number[] = Array.isArray(field.value)
              ? field.value
              : form.getValues("service_category_id")
              ? [form.getValues("service_category_id")]
              : []

            const toggleCategory = (catId: number) => {
              let updated: number[]
              if (currentCategoryIds.includes(catId)) {
                updated = currentCategoryIds.filter((id) => id !== catId)
              } else {
                updated = [...currentCategoryIds, catId]
              }
              field.onChange(updated)
              if (updated.length > 0) {
                form.setValue("service_category_id", updated[0])
              }
            }

            return (
              <FormItem>
                <FormLabel>Service Categories / Groups (Select all that apply)</FormLabel>
                <FormControl>
                  <div className="flex flex-wrap gap-2 p-3 border rounded-md bg-muted/20">
                    {categories.map((category) => {
                      const isSelected = currentCategoryIds.includes(category.service_category_id)
                      return (
                        <button
                          key={category.service_category_id}
                          type="button"
                          onClick={() => toggleCategory(category.service_category_id)}
                          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary shadow-sm scale-105"
                              : "bg-background hover:bg-muted text-muted-foreground border-border"
                          }`}
                        >
                          {category.icon && <span>{category.icon}</span>}
                          <span>{category.name}</span>
                        </button>
                      )
                    })}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )
          }}
        />
      ) : (
        <div className="space-y-2">
          <FormLabel>Service Category</FormLabel>
          <div className="p-3 bg-muted rounded-md">
            <span className="text-sm font-medium">{selectedCategoryName}</span>
            <p className="text-xs text-muted-foreground mt-1">
              Category is pre-selected for this provider
            </p>
          </div>
        </div>
      )}

      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input placeholder="Enter provider name" {...field} />
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
                placeholder="Brief description of the service provider"
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
        name="bio"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Bio</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Detailed bio or about section"
                className="resize-none"
                rows={4}
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
