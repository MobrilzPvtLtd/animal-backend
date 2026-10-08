"use client";

import React, { useState, useEffect } from "react";
import {
  CreditCard,
  Plus,
  Search,
  Edit,
  Trash2,
  Calendar,
  Loader2,
  CheckCircle2,
  X,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

export interface SubscriptionPlan {
  subscription_plan_id: number;
  plan_code: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  billing_cycle: string;
  duration_days: number;
  features: string[];
  badge_text: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export function SubscriptionPlansCrud() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);

  const [deletingPlan, setDeletingPlan] = useState<SubscriptionPlan | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    plan_code: "",
    name: "",
    description: "",
    price: "",
    currency: "ZAR",
    billing_cycle: "monthly",
    duration_days: "30",
    features: ["List up to 5 places", "Basic Analytics", "Support Access"],
    badge_text: "",
    is_active: true,
  });

  const [newFeatureInput, setNewFeatureInput] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .order("price");

      if (error) {
        console.error("Fetch plans error:", error);
      } else {
        setPlans(data || []);
      }
    } catch (err) {
      console.error("Fetch plans error:", err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      plan_code: "",
      name: "",
      description: "",
      price: "",
      currency: "ZAR",
      billing_cycle: "monthly",
      duration_days: "30",
      features: ["List up to 5 places", "Basic Analytics", "Support Access"],
      badge_text: "",
      is_active: true,
    });
    setNewFeatureInput("");
  };

  const openCreateModal = () => {
    setEditingPlan(null);
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setFormData({
      plan_code: plan.plan_code || "",
      name: plan.name || "",
      description: plan.description || "",
      price: plan.price.toString(),
      currency: plan.currency || "ZAR",
      billing_cycle: plan.billing_cycle || "monthly",
      duration_days: plan.duration_days.toString(),
      features: Array.isArray(plan.features) ? [...plan.features] : [],
      badge_text: plan.badge_text || "",
      is_active: plan.is_active ?? true,
    });
    setNewFeatureInput("");
    setIsModalOpen(true);
  };

  const handleAddFeature = () => {
    const trimmed = newFeatureInput.trim();
    if (!trimmed) return;
    setFormData((prev) => ({
      ...prev,
      features: [...prev.features, trimmed],
    }));
    setNewFeatureInput("");
  };

  const handleRemoveFeature = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index),
    }));
  };

  const savePlan = async () => {
    if (!formData.name || !formData.price) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const slugName = formData.name
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");
      const uniqueSuffix = Math.floor(1000 + Math.random() * 9000);
      const generatedCode = `${slugName}_${Math.floor(Number(formData.price))}_${uniqueSuffix}`;

      if (editingPlan) {
        const { error } = await supabase
          .from("subscription_plans")
          .update({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            price: parseFloat(formData.price),
            currency: formData.currency,
            billing_cycle: formData.billing_cycle,
            duration_days: parseInt(formData.duration_days) || 30,
            features: formData.features,
            badge_text: formData.badge_text.trim() || null,
            is_active: formData.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq("subscription_plan_id", editingPlan.subscription_plan_id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("subscription_plans")
          .insert([
            {
              plan_code: generatedCode,
              name: formData.name.trim(),
              description: formData.description.trim() || null,
              price: parseFloat(formData.price),
              currency: formData.currency,
              billing_cycle: formData.billing_cycle,
              duration_days: parseInt(formData.duration_days) || 30,
              features: formData.features,
              badge_text: formData.badge_text.trim() || null,
              is_active: formData.is_active,
            },
          ]);

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: editingPlan
          ? "Subscription plan updated successfully"
          : "Subscription plan created successfully",
      });
      setIsModalOpen(false);
      resetForm();
      fetchPlans();
    } catch (err: any) {
      console.error("Save plan error:", err);
      toast({
        title: "Error",
        description: err?.message || "Error saving plan",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const deletePlan = async () => {
    if (!deletingPlan) return;
    try {
      const { error } = await supabase
        .from("subscription_plans")
        .delete()
        .eq("subscription_plan_id", deletingPlan.subscription_plan_id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Subscription plan deleted successfully",
      });
      setDeletingPlan(null);
      fetchPlans();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message || "Failed to delete plan",
        variant: "destructive",
      });
    }
  };

  const filteredPlans = plans.filter(
    (pkg) =>
      pkg.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pkg.plan_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pkg.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <CreditCard className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Subscription Plans</h1>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="h-4 w-4 mr-2" />
          Add Plan
        </Button>
      </div>

      {/* Search Bar */}
      <div className="flex items-center space-x-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search plans..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Plans Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredPlans.map((pkg) => (
          <Card key={pkg.subscription_plan_id} className={!pkg.is_active ? "opacity-60" : ""}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg font-medium">{pkg.name}</CardTitle>
                  {pkg.badge_text && (
                    <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">
                      {pkg.badge_text}
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground font-mono">{pkg.plan_code}</span>
              </div>
              <div className="flex space-x-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditModal(pkg)}
                >
                  <Edit className="h-3 w-3" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeletingPlan(pkg)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Duration:</span>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {pkg.duration_days} days ({pkg.billing_cycle})
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Price:</span>
                  <Badge className="flex items-center gap-1 font-bold text-sm">
                    R{Number(pkg.price).toFixed(2)}
                  </Badge>
                </div>
                {pkg.description && (
                  <div>
                    <span className="text-sm text-muted-foreground">Description:</span>
                    <p className="text-sm mt-1">{pkg.description}</p>
                  </div>
                )}
                {Array.isArray(pkg.features) && pkg.features.length > 0 && (
                  <div>
                    <span className="text-sm text-muted-foreground">Included Features:</span>
                    <ul className="mt-1.5 space-y-1">
                      {pkg.features.map((feat, idx) => (
                        <li key={idx} className="flex items-center text-xs gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredPlans.length === 0 && (
        <div className="text-center py-8">
          <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">No subscription plans found</h3>
          <p className="text-sm text-muted-foreground">
            {searchTerm
              ? "Try adjusting your search"
              : "Create your first subscription plan to get started"}
          </p>
        </div>
      )}

      {/* Create / Edit Plan Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {editingPlan ? "Edit Subscription Plan" : "Create Subscription Plan"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Package Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Service Provider Monthly Plan"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="badge_text">Badge Text (Optional)</Label>
                <Input
                  id="badge_text"
                  value={formData.badge_text}
                  onChange={(e) => setFormData({ ...formData, badge_text: e.target.value })}
                  placeholder="e.g., PROVIDER, BEST VALUE"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="billing_cycle">Plan Type *</Label>
                <Select
                  value={formData.billing_cycle}
                  onValueChange={(val) =>
                    setFormData({
                      ...formData,
                      billing_cycle: val,
                      duration_days: val === "yearly" ? "365" : "30",
                    })
                  }
                >
                  <SelectTrigger id="billing_cycle">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                    <SelectItem value="one_time">One-Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="duration_days">Duration (Days) *</Label>
                <Input
                  id="duration_days"
                  type="number"
                  value={formData.duration_days}
                  onChange={(e) => setFormData({ ...formData, duration_days: e.target.value })}
                  placeholder="e.g., 30"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="price">Price (R) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="e.g., 99.00"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Package description..."
                rows={3}
              />
            </div>

            {/* Dynamic Features Input */}
            <div className="grid gap-2">
              <Label>Included Features</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. List up to 5 places"
                  value={newFeatureInput}
                  onChange={(e) => setNewFeatureInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddFeature();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={handleAddFeature}>
                  Add
                </Button>
              </div>

              <div className="space-y-1 mt-2">
                {formData.features.map((feat, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between gap-2 p-1.5 bg-muted rounded text-xs"
                  >
                    <span className="truncate">{feat}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFeature(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-2">
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={savePlan} disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingPlan ? "Update Package" : "Create Package"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={Boolean(deletingPlan)} onOpenChange={() => setDeletingPlan(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subscription Plan</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this subscription plan? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deletePlan}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
