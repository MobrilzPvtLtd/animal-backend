"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { isSuperAdmin, roleKey, roleLabel, systemRoleOptions } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/providers/AuthProvider";
import { UsersIcon, Plus, Search, Edit, Trash2, UserPlus, Filter, ShieldCheck, UserCheck, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface User {
  user_id: string;
  user_name: string;
  email: string;
  avatar_url: string;
  is_verified: boolean;
  subscription_status?: string | null;
  created_at: string;
  user_roles: UserRole[];
}

interface UserRole {
  role_id: number;
  vet_id: number | null;
  breeder_id: number | null;
  pet_friendly_place_id: number | null;
  service_provider_id: number | null;
  roles: {
    role_id: number;
    name: string;
    description: string;
    is_system_role: boolean;
  };
}

interface Role {
  role_id: number;
  name: string;
  description: string;
  is_system_role: boolean;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);
  const [selectedUserRoles, setSelectedUserRoles] = useState<number[]>([]);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false);
  const [newUserData, setNewUserData] = useState({
    name: "",
    surname: "",
    email: "",
    phone: "",
    password: "",
  });

  const { toast } = useToast();
  const roleOptions = systemRoleOptions(roles);

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  const fetchUsers = async () => {
    try {
      const selectWithVerified = `
          user_id,
          user_name,
          email,
          avatar_url:profile_image_url,
          is_verified,
          subscription_status,
          created_at,
          user_roles (
            role_id,
            roles (
              role_id,
              name,
              description,
              is_system_role
            )
          )
        `;

      const selectWithoutVerified = `
          user_id,
          user_name,
          email,
          avatar_url:profile_image_url,
          subscription_status,
          created_at,
          user_roles (
            role_id,
            roles (
              role_id,
              name,
              description,
              is_system_role
            )
          )
        `;

      let res: any = await supabase
        .from("users")
        .select(selectWithVerified)
        .order("created_at", { ascending: false });

      // If the column doesn't exist on the database, retry without it
      if (res.error && String(res.error.message).includes('is_verified')) {
        res = await supabase
          .from("users")
          .select(selectWithoutVerified)
          .order("created_at", { ascending: false });
      }

      if (res.error) throw res.error;
      // ensure is_verified exists on each row for UI
      const rows = (res.data as any[] || []).map((r) => ({ ...r, is_verified: r.is_verified ?? false }));
      setUsers(rows);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error",
        description: "Failed to fetch users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const { data, error } = await supabase
        .from("roles")
        .select("*")
        .order("name");

      if (error) throw error;
      setRoles(data || []);
    } catch (error) {
      console.error("Error fetching roles:", error);
    }
  };

  const openRoleDialog = (user: User) => {
    setSelectedUser(user);
    setSelectedUserRoles(user.user_roles.map(ur => ur.role_id));
    setIsRoleDialogOpen(true);
  };

  const handleDeleteUser = (user: User) => {
    const isTargetOwner = user.user_roles.some(ur => isSuperAdmin(ur.roles?.name));
    if (isTargetOwner) {
      toast({
        title: "Cannot Delete",
        description: "Super Admin accounts cannot be deleted",
        variant: "destructive",
      });
      return;
    }
    setUserToDelete(user);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete || deletingUser) return;
    setDeletingUser(true);

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) throw new Error('Your session has expired. Sign in and try again.');
      const response = await fetch(`/api/v1/users?user_id=${userToDelete.user_id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success !== true || String(result.deleted_user_id) !== String(userToDelete.user_id)) {
        throw new Error(result.error || "User deletion was not confirmed. Refresh and try again.");
      }

      toast({
        title: "Success",
        description: `User ${userToDelete.user_name || userToDelete.email} has been deleted`,
      });

      setUsers(previous => previous.filter(u => String(u.user_id) !== String(userToDelete.user_id)));
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
      setDeletingUser(false);
    }
  };

  const updateUserRoles = async () => {
    if (!selectedUser) return;

    try {
      // Remove existing roles
      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", selectedUser.user_id);

      // Add new roles
      if (selectedUserRoles.length > 0) {
        const userRoles = selectedUserRoles.map(roleId => ({
          user_id: selectedUser.user_id,
          role_id: roleId,
        }));

        const { error } = await supabase
          .from("user_roles")
          .insert(userRoles);

        if (error) throw error;
      }

      // Sync subscription_status if user is assigned privileged roles or Subscriber
      const hasPrivilegedRole = roles
        .filter((r) => selectedUserRoles.includes(r.role_id))
        .some((r) => isSuperAdmin(r.name) || ["Subscriber"].includes(r.name));

      await supabase
        .from("users")
        .update({ subscription_status: hasPrivilegedRole ? "active" : "guest" })
        .eq("user_id", selectedUser.user_id);

      toast({
        title: "Success",
        description: "User roles & permissions updated successfully",
      });

      setIsRoleDialogOpen(false);
      fetchUsers();
    } catch (error) {
      console.error("Error updating user roles:", error);
      toast({
        title: "Error",
        description: "Failed to update user roles",
        variant: "destructive",
      });
    }
  };

  const filteredUsers = users.filter((user) => {
    const term = searchTerm.toLowerCase().trim();
    const userRoleNames = user.user_roles.map((ur) => roleKey(ur.roles?.name));
    const subStatus = (user.subscription_status || "guest").toLowerCase();

    // 1. Check Search Term (Matches Name, Email, Role name, or Subscription Status)
    const matchesSearch =
      !term ||
      (user.user_name?.toLowerCase() || "").includes(term) ||
      (user.email?.toLowerCase() || "").includes(term) ||
      userRoleNames.some((r) => r.includes(term)) ||
      subStatus.includes(term);

    // 2. Check Role Filter
    const matchesRole =
      selectedRoleFilter === "all" ||
      user.user_roles.some((ur) => roleKey(ur.roles?.name) === selectedRoleFilter);

    // 3. Check Subscription Status Filter
    const isSubscriber =
      subStatus === "active" ||
      subStatus === "subscribed" ||
      userRoleNames.includes("subscriber") ||
      userRoleNames.includes("super admin");

    const matchesStatus =
      selectedStatusFilter === "all" ||
      (selectedStatusFilter === "subscriber" && isSubscriber) ||
      (selectedStatusFilter === "guest" && !isSubscriber);

    return matchesSearch && matchesRole && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <UsersIcon className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Users Management</h1>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-muted/40 p-4 rounded-xl border">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search Bar - Supports searching User, Email, or Role */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by user, email, or role (e.g. Super Admin, Subscriber, Guest)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>

          {/* Role Filter Dropdown */}
          <div className="w-full sm:w-[200px]">
            <Select value={selectedRoleFilter} onValueChange={setSelectedRoleFilter}>
              <SelectTrigger className="bg-background">
                <div className="flex items-center gap-2 truncate">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue placeholder="Filter by Role" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {roleOptions.map((r) => (
                  <SelectItem key={r.role_id} value={roleKey(r.name)}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subscription Status Filter */}
          <div className="w-full sm:w-[200px]">
            <Select value={selectedStatusFilter} onValueChange={setSelectedStatusFilter}>
              <SelectTrigger className="bg-background">
                <div className="flex items-center gap-2 truncate">
                  <UserCheck className="h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue placeholder="All Access Types" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Access Types</SelectItem>
                <SelectItem value="subscriber">Subscribers / Active</SelectItem>
                <SelectItem value="guest">Guest / Free Users</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Quick Statistics Counters */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground self-end md:self-center">
          <Badge variant="outline" className="text-xs">
            Showing {filteredUsers.length} of {users.length} users
          </Badge>
          {(searchTerm || selectedRoleFilter !== "all" || selectedStatusFilter !== "all") && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm("");
                setSelectedRoleFilter("all");
                setSelectedStatusFilter("all");
              }}
              className="h-7 text-xs px-2 text-primary"
            >
              Reset filters
            </Button>
          )}
        </div>
      </div>

      {/* Users Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredUsers.length === 0 ? (
          <div className="col-span-full py-12 text-center text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
            <UsersIcon className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="font-medium">No users match your search or filter</p>
            <p className="text-xs mt-1">Try resetting the role or search filters above.</p>
          </div>
        ) : (
          filteredUsers.map((user) => {
            const userRoleNames = user.user_roles.map((ur) => roleLabel(ur.roles?.name || ""));
            const isSubscriber =
              (user.subscription_status || "").toLowerCase() === "active" ||
              userRoleNames.includes("Subscriber") ||
              userRoleNames.includes("Super Admin");

            return (
              <Card key={user.user_id} className="transition-shadow hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="space-y-0.5 max-w-[70%]">
                    <CardTitle className="text-sm font-semibold truncate">
                      {user.user_name || user.email}
                    </CardTitle>
                    <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openRoleDialog(user)}
                      title="Manage User Roles"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={user.user_roles.some((ur) => isSuperAdmin(ur.roles?.name))}
                      title={
                        user.user_roles.some((ur) => isSuperAdmin(ur.roles?.name))
                          ? "Super Admin accounts cannot be deleted"
                          : "Delete user"
                      }
                      onClick={() => handleDeleteUser(user)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Status & Verification Badges */}
                  <div className="flex items-center gap-2 pt-1">
                    {isSubscriber ? (
                      <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] gap-1 shadow-sm">
                        <Sparkles className="h-3 w-3" />
                        Active Subscriber
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-slate-600 border-slate-300 text-[11px]">
                        Guest Access
                      </Badge>
                    )}

                    {user.is_verified && (
                      <span className="text-xs text-emerald-600 font-medium">✓ Verified</span>
                    )}
                  </div>

                  {/* Role Badges */}
                  <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-100">
                    <span className="text-[11px] text-muted-foreground mr-1 self-center">Roles:</span>
                    {user.user_roles.length === 0 ? (
                      <Badge variant="secondary" className="text-xs">
                        Guest
                      </Badge>
                    ) : (
                      systemRoleOptions(user.user_roles.filter(ur => ur.roles).map(ur => ({ role_id: ur.role_id, name: ur.roles.name }))).map((ur) => {
                        const rName = ur.name;
                        const isOwner = isSuperAdmin(rName);
                        const isSub = rName === "Subscriber";

                        let badgeClass = "text-xs";
                        if (isOwner) badgeClass = "bg-purple-100 text-purple-800 border-purple-200";
                        else if (isSub) badgeClass = "bg-emerald-100 text-emerald-800 border-emerald-200";

                        return (
                          <Badge
                            key={ur.role_id}
                            variant="secondary"
                            className={badgeClass}
                          >
                            {rName}
                          </Badge>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Delete User Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the user{" "}
              <span className="font-medium">{userToDelete?.user_name || userToDelete?.email}</span>
              . This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingUser} onClick={() => setUserToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction disabled={deletingUser} onClick={event => { event.preventDefault(); confirmDeleteUser(); }} className="bg-destructive text-destructive-foreground">
              {deletingUser ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Role Assignment Dialog */}
      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Manage User Roles</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label className="text-base font-medium">
                Assign roles to {selectedUser?.user_name || selectedUser?.email}
              </Label>
            </div>
            <div className="space-y-2">
              {roleOptions.map((role) => (
                <div key={role.role_id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`role-${role.role_id}`}
                    checked={role.role_ids.some(id => selectedUserRoles.includes(id))}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedUserRoles([...selectedUserRoles.filter(id => !role.role_ids.includes(id)), role.role_id]);
                      } else {
                        setSelectedUserRoles(
                          selectedUserRoles.filter((id) => !role.role_ids.includes(id))
                        );
                      }
                    }}
                  />
                  <Label htmlFor={`role-${role.role_id}`} className="text-sm">
                    <div>
                      <span className="font-medium">{role.name}</span>
                      {role.description && (
                        <div className="text-xs text-muted-foreground">
                          {isSuperAdmin(role.name) ? 'Full platform administration' : role.description}
                        </div>
                      )}
                    </div>
                  </Label>
                </div>
              ))}
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setIsRoleDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={updateUserRoles}>
                Update Roles
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
