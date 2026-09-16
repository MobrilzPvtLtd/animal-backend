"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  User as UserIcon,
  Phone,
  Shield,
  CheckCircle,
  Trash2,
  MapPin,
  Compass,
  Navigation,
  Store,
  Building2,
  Layers,
  Sparkles,
  Loader2,
} from "lucide-react";
import Swal from "sweetalert2";
import { useRouter } from "next/navigation";

interface UserProfile {
  user_id: string;
  user_name: string;
  name?: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  is_verified: boolean;
  subscription_status: string;
  user_type?: string;
  created_at: string;
  static_location?: string;
  latitude?: number | null;
  longitude?: number | null;
  preferred_radius?: number | string | null;
  permissions?: Array<{
    permission_id: number;
    name: string;
    description?: string | null;
    resource?: string;
    action?: string;
  }>;
  user_roles?: Array<{
    role_id: number;
    roles?: {
      role_id: number;
      name: string;
      description: string;
      is_system_role: boolean;
    };
  }>;
}

interface NearbyData {
  radius_km: number;
  counts: {
    places: number;
    service_providers: number;
    total: number;
  };
  places: Array<{
    pet_friendly_place_id: number;
    name: string;
    address?: string;
    distance_km?: number | null;
    formatted_distance?: string;
  }>;
  service_providers: Array<{
    service_provider_id: number;
    name: string;
    description?: string;
    distance_km?: number | null;
    formatted_distance?: string;
  }>;
}

const RADIUS_OPTIONS: (number | 'all')[] = ['all', 5, 10, 20, 50, 100];

export default function AccountPage() {
  const { session, logOutFunction } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Nearby discovery preview
  const [nearbyData, setNearbyData] = useState<NearbyData | null>(null);
  const [nearbyLoading, setNearbyLoading] = useState(false);

  const [formData, setFormData] = useState({
    user_name: "",
    name: "",
    phone: "",
    static_location: "",
    preferred_radius: 25 as number | string,
  });

  const { toast } = useToast();

  useEffect(() => {
    if (session?.access_token) {
      fetchUserProfile();
    } else {
      setLoading(false);
    }
  }, [session?.access_token]);

  const fetchNearbyDiscovery = async (radiusKm: number | string) => {
    if (!session?.access_token) return;
    try {
      setNearbyLoading(true);
      const res = await fetch(`/api/v1/locations/nearby?radius=${radiusKm}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setNearbyData(data);
      }
    } catch (err) {
      console.error("Error fetching nearby items:", err);
    } finally {
      setNearbyLoading(false);
    }
  };

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/v1/auth/me", {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Error fetching profile:", errorData);
        toast({
          title: "Error",
          description: "Failed to load profile",
          variant: "destructive",
        });
        return;
      }

      const { profile: data } = await response.json();

      if (data) {
        const transformedProfile: UserProfile = {
          ...data,
          user_roles:
            data.user_roles?.map((ur: any) => ({
              role_id: ur.role_id,
              roles: Array.isArray(ur.roles) ? ur.roles[0] : ur.roles,
            })) || [],
        } as UserProfile;

        setProfile(transformedProfile);

        const currentRadius = data.preferred_radius === 'all' || !data.preferred_radius || data.preferred_radius === 0
          ? 'all'
          : Number(data.preferred_radius);

        setFormData({
          user_name: data.user_name || "",
          name: data.name || "",
          phone: data.phone || "",
          static_location: data.static_location || "",
          preferred_radius: currentRadius,
        });

        // Load nearby places & service providers within the radius circle
        if (data.latitude || data.static_location) {
          fetchNearbyDiscovery(currentRadius);
        }
      } else {
        setProfile(null);
      }
    } catch (error) {
      console.error("Error:", error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickRadiusSelect = async (radiusKm: number | 'all') => {
    setFormData((prev) => ({ ...prev, preferred_radius: radiusKm }));
    fetchNearbyDiscovery(radiusKm);

    if (!isEditing && session?.access_token) {
      try {
        const res = await fetch("/api/v1/auth/me", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ preferred_radius: radiusKm }),
        });
        if (res.ok) {
          toast({
            title: "Discovery Radius Updated",
            description: radiusKm === 'all'
              ? "Showing all places and providers without radius constraint."
              : `Places and providers within ${radiusKm} km will now show up.`,
          });
          setProfile((prev) => (prev ? { ...prev, preferred_radius: radiusKm } : null));
        }
      } catch (err) {
        console.error("Failed to update radius preference:", err);
      }
    }
  };

  const handleDeleteAccount = async () => {
    const result = await Swal.fire({
      icon: "warning",
      title: "Are you absolutely sure?",
      text: "This action cannot be undone. This will permanently delete your account and remove all your data from our servers.",
      showCancelButton: true,
      confirmButtonText: "Yes, delete my account",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#dc2626",
      reverseButtons: true,
    });

    if (!result.isConfirmed) return;

    try {
      const response = await fetch("/api/v1/auth/delete-account", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        Swal.fire({
          icon: "error",
          title: "Error",
          text: errorData.error || "Failed to delete account",
        });
        return;
      }

      await Swal.fire({
        icon: "success",
        title: "Account Deleted",
        text: "Your account has been permanently deleted.",
        confirmButtonColor: "#2563eb",
      });

      await logOutFunction();
      router.push("/");
    } catch (error: any) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message || "Failed to delete account",
      });
    }
  };

  const handleUpdateProfile = async () => {
    if (!profile || !session?.access_token) return;

    try {
      setIsSaving(true);
      const response = await fetch("/api/v1/auth/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone,
          static_location: formData.static_location,
          preferred_radius: Number(formData.preferred_radius) || 25,
        }),
      });

      const resData = await response.json();

      if (!response.ok) {
        toast({
          title: "Error",
          description: resData.error || "Failed to update profile",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Profile, location & discovery radius updated successfully",
      });

      setIsEditing(false);
      fetchUserProfile();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No profile found</p>
      </div>
    );
  }

  const initials = (profile.user_name || profile.name || profile.email)
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const rawActive = isEditing ? formData.preferred_radius : profile.preferred_radius;
  const isAllRadius =
    rawActive === 'all' ||
    rawActive === null ||
    rawActive === undefined ||
    rawActive === 0 ||
    rawActive === '0';
  const activeRadius: number | 'all' = isAllRadius ? 'all' : Number(rawActive);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <UserIcon className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Account</h1>
            <p className="text-sm text-muted-foreground">
              Manage your personal profile, location, and discovery radius preferences
            </p>
          </div>
        </div>
      </div>

      {/* Main Profile Card */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between pb-6 border-b">
          <div className="flex items-center space-x-4">
            <Avatar className="h-16 w-16 border-2 border-primary/20">
              <AvatarImage src={profile.avatar_url} alt={profile.user_name} />
              <AvatarFallback className="text-lg font-semibold bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-2xl font-bold">{profile.name || profile.user_name}</CardTitle>
              <p className="text-sm text-muted-foreground font-mono">{profile.email}</p>
              {profile.phone && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <Phone className="h-3 w-3" /> {profile.phone}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {!isEditing && (
              <Button onClick={() => setIsEditing(true)} variant="outline" className="gap-2">
                Edit Profile
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {/* Verification Status */}
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="font-medium">Verification Status</span>
            </div>
            {profile.is_verified ? (
              <Badge variant="default" className="bg-green-600 text-white">
                Verified
              </Badge>
            ) : (
              <Badge variant="secondary">Pending Verification</Badge>
            )}
          </div>

          {/* ─────────────────────────────────────────────────────────────
              LOCATION & DISCOVERY RADIUS SECTION
          ───────────────────────────────────────────────────────────── */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-50/70 via-indigo-50/40 to-slate-50 dark:from-slate-900 dark:via-indigo-950/20 dark:to-slate-900 border border-blue-100 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-600 text-white shadow-sm">
                  <Compass className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                    Location & Discovery Radius
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Pet friendly places & service providers inside this circle will show up for you
                  </p>
                </div>
              </div>

              <Badge variant="outline" className="bg-white/80 dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-semibold px-3 py-1 border-blue-200">
                <Navigation className="h-3 w-3 mr-1 inline" /> Radius Circle: {activeRadius} km
              </Badge>
            </div>

            {/* Current Location Display */}
            <div className="flex items-start gap-3 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <MapPin className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Your Location
                </div>
                <div className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                  {profile.static_location || formData.static_location || "No location set (Click 'Edit Profile' to add your location)"}
                </div>
                {profile.latitude && profile.longitude && (
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">
                    Lat: {Number(profile.latitude).toFixed(4)}, Lng: {Number(profile.longitude).toFixed(4)}
                  </div>
                )}
              </div>
            </div>

            {/* Radius Selection Buttons */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
                <span>Select Radius Distance:</span>
                <span className="text-muted-foreground">Tap a distance to instantly filter</span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {RADIUS_OPTIONS.map((km) => {
                  const isSelected = activeRadius === km;
                  return (
                    <Button
                      key={km}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      className={`h-11 font-semibold rounded-xl text-sm transition-all ${
                        isSelected
                          ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md scale-[1.02]"
                          : "bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700"
                      }`}
                      onClick={() => handleQuickRadiusSelect(km)}
                    >
                      {km === 'all' ? 'All (No limit)' : `${km} km`}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Live Discovery Summary Box */}
            <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/80">
              <div className="flex items-center justify-between flex-wrap gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  Inside Your {activeRadius} km Circle:
                </span>
                {nearbyLoading ? (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching circle...
                  </span>
                ) : nearbyData?.counts ? (
                  <span className="text-blue-600 dark:text-blue-400 font-bold">
                    {nearbyData.counts.places} Places • {nearbyData.counts.service_providers} Service Providers ({nearbyData.counts.total} Total)
                  </span>
                ) : (
                  <span className="text-muted-foreground">Set your location to see nearby items</span>
                )}
              </div>

              {/* Discovery preview list */}
              {nearbyData && nearbyData.counts.total > 0 && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {/* Places */}
                  {nearbyData.places.slice(0, 4).map((place) => (
                    <div
                      key={place.pet_friendly_place_id}
                      className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Store className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span className="font-semibold truncate">{place.name}</span>
                      </div>
                      <Badge variant="secondary" className="text-[11px] shrink-0 font-medium bg-emerald-50 text-emerald-700 border-emerald-200">
                        {place.formatted_distance || `${place.distance_km?.toFixed(1)} km`}
                      </Badge>
                    </div>
                  ))}

                  {/* Service Providers */}
                  {nearbyData.service_providers.slice(0, 4).map((provider) => (
                    <div
                      key={provider.service_provider_id}
                      className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Building2 className="h-4 w-4 text-indigo-600 shrink-0" />
                        <span className="font-semibold truncate">{provider.name}</span>
                      </div>
                      <Badge variant="secondary" className="text-[11px] shrink-0 font-medium bg-indigo-50 text-indigo-700 border-indigo-200">
                        {provider.formatted_distance || `${provider.distance_km?.toFixed(1)} km`}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Roles */}
          {profile.user_roles && profile.user_roles.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Shield className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Roles & Permissions</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {profile.user_roles.map(
                  (ur) =>
                    ur.roles && (
                      <div
                        key={ur.role_id}
                        className="space-y-1 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border"
                      >
                        <Badge variant="default">{ur.roles.name}</Badge>
                        <p className="text-xs text-muted-foreground">{ur.roles.description}</p>
                      </div>
                    )
                )}
              </div>
            </div>
          )}

          {/* User Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-1.5 p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border">
              <Label className="text-xs font-semibold text-muted-foreground uppercase">User ID</Label>
              <p className="text-sm font-mono">{profile.user_id}</p>
            </div>
            <div className="space-y-1.5 p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border">
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Account Type</Label>
              <div>
                <Badge variant="outline" className="capitalize">
                  {profile.user_type || "user"}
                </Badge>
              </div>
            </div>
            <div className="space-y-1.5 p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border">
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Subscription Status</Label>
              <div>
                <Badge variant="outline" className="capitalize">
                  {profile.subscription_status || "guest"}
                </Badge>
              </div>
            </div>
            <div className="space-y-1.5 p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border">
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Member Since</Label>
              <p className="text-sm text-muted-foreground">
                {new Date(profile.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Edit Form */}
          {isEditing && (
            <div className="space-y-4 pt-6 border-t">
              <h3 className="font-bold text-lg">Edit Profile Information</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter full name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Enter phone number"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="static_location" className="flex items-center gap-1">
                    <MapPin className="h-4 w-4 text-red-500" /> Location / Address
                  </Label>
                  <Input
                    id="static_location"
                    value={formData.static_location}
                    onChange={(e) => setFormData({ ...formData, static_location: e.target.value })}
                    placeholder="e.g. Rosebank, Johannesburg, South Africa"
                  />
                  <p className="text-xs text-muted-foreground">
                    We automatically determine your coordinates from this address to calculate distances.
                  </p>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="preferred_radius" className="flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Compass className="h-4 w-4 text-blue-500" /> Discovery Radius
                    </span>
                    <span className="text-xs text-blue-600 font-semibold">
                      {formData.preferred_radius === 'all' ? 'All (No radius limit)' : `${formData.preferred_radius} km circle`}
                    </span>
                  </Label>
                  <Input
                    id="preferred_radius"
                    type="text"
                    value={formData.preferred_radius === 'all' ? 'all' : formData.preferred_radius}
                    onChange={(e) => {
                      const val = e.target.value.trim().toLowerCase();
                      if (val === 'all' || val === '0' || val === '') {
                        setFormData({ ...formData, preferred_radius: 'all' });
                      } else {
                        const num = parseFloat(val);
                        setFormData({ ...formData, preferred_radius: !isNaN(num) ? num : val });
                      }
                    }}
                    placeholder="Enter km (e.g. 10, 20) or 'all'"
                  />
                  <div className="flex flex-wrap gap-2 mt-2">
                    {RADIUS_OPTIONS.map((km) => (
                      <Button
                        key={km}
                        type="button"
                        size="sm"
                        variant={
                          formData.preferred_radius === km ||
                          (km === 'all' && (formData.preferred_radius === 'all' || !formData.preferred_radius || formData.preferred_radius === 0))
                            ? "default"
                            : "outline"
                        }
                        className="h-8 text-xs font-semibold rounded-lg"
                        onClick={() => setFormData({ ...formData, preferred_radius: km })}
                      >
                        {km === 'all' ? 'All (No limit)' : `${km} km`}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="email">Email (Read-only)</Label>
                  <Input id="email" value={profile.email} disabled className="bg-muted" />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button onClick={handleUpdateProfile} disabled={isSaving} className="flex-1 font-semibold">
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving Changes...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
                <Button
                  onClick={() => setIsEditing(false)}
                  variant="outline"
                  className="flex-1"
                  disabled={isSaving}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50 shadow-sm">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2 text-lg">
            <Trash2 className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Once you delete your account, there is no going back. Please be certain.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleDeleteAccount}>
            Delete My Account
          </Button>
        </CardContent>
      </Card>

      {/* Logout Button */}
      <div className="flex justify-end">
        <Button onClick={logOutFunction} variant="destructive">
          Log Out
        </Button>
      </div>
    </div>
  );
}
