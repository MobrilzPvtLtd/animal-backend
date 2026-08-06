"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Loader2, Trash2, Search, RefreshCw, MessageSquare, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

type ModerationComment = {
  comment_id: number;
  post_id: number;
  user_id: number;
  comment: string;
  created_at: string;
  users?: {
    user_name?: string | null;
    name?: string | null;
  } | null;
  community_posts?: {
    title?: string | null;
    body?: string | null;
  } | null;
};

export default function CommunityCommentsPage() {
  const [comments, setComments] = useState<ModerationComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedPostFilter, setSelectedPostFilter] = useState<string>("all");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedComment, setSelectedComment] = useState<ModerationComment | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadComments();
  }, []);

  async function loadComments() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("community_comments")
        .select(`
          comment_id,
          post_id,
          user_id,
          comment,
          created_at,
          users!user_id ( user_name, name ),
          community_posts!post_id ( title, body )
        `)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setComments((data || []) as any[]);
    } catch (error: any) {
      console.error("Error loading comments:", error);
      toast.error("Failed to load comments for moderation");
    } finally {
      setLoading(false);
    }
  }

  async function confirmDelete() {
    if (!selectedComment) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("community_comments")
        .delete()
        .eq("comment_id", selectedComment.comment_id);

      if (error) throw error;

      toast.success("Comment deleted successfully");
      setComments((prev) => prev.filter((c) => c.comment_id !== selectedComment.comment_id));
      setDeleteOpen(false);
      setSelectedComment(null);
    } catch (error: any) {
      console.error("Error deleting comment:", error);
      toast.error(error?.message || "Failed to delete comment");
    } finally {
      setDeleting(false);
    }
  }

  // Get unique list of post titles for filter
  const postOptions = Array.from(
    new Set(comments.map((c) => c.community_posts?.title || `Post #${c.post_id}`))
  );

  const filteredComments = comments.filter((comment) => {
    const textMatch =
      comment.comment.toLowerCase().includes(search.toLowerCase()) ||
      (comment.users?.user_name || comment.users?.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (comment.community_posts?.title || "").toLowerCase().includes(search.toLowerCase());

    const postMatch =
      selectedPostFilter === "all" ||
      (comment.community_posts?.title || `Post #${comment.post_id}`) === selectedPostFilter;

    return textMatch && postMatch;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            Community Comments
          </h1>
          <p className="text-sm text-muted-foreground">
            Review and moderate user comments across all community posts.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadComments} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-center gap-4 justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search comment or author..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Filter Post:</span>
              <select
                className="h-10 w-full sm:w-56 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedPostFilter}
                onChange={(e) => setSelectedPostFilter(e.target.value)}
              >
                <option value="all">All Posts ({comments.length})</option>
                {postOptions.map((title, idx) => (
                  <option key={idx} value={title}>
                    {title.length > 35 ? title.substring(0, 35) + "..." : title}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredComments.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-muted/20">
              <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground mb-3 opacity-50" />
              <h3 className="font-semibold text-lg">No comments found</h3>
              <p className="text-sm text-muted-foreground">
                {search || selectedPostFilter !== "all"
                  ? "No comments match your search filter."
                  : "No community comments have been posted yet."}
              </p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Author</TableHead>
                    <TableHead className="w-[200px]">Post Title</TableHead>
                    <TableHead>Comment Content</TableHead>
                    <TableHead className="w-[140px]">Date</TableHead>
                    <TableHead className="w-[100px] text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredComments.map((item) => (
                    <TableRow key={item.comment_id}>
                      <TableCell className="font-medium">
                        {item.users?.user_name || item.users?.name || `User #${item.user_id}`}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-foreground truncate max-w-[180px]">
                            {item.community_posts?.title || `Post #${item.post_id}`}
                          </span>
                          <Link href="/dashboard/community" target="_blank">
                            <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-primary" />
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-800 dark:text-slate-200">
                        {item.comment}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(item.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setSelectedComment(item);
                            setDeleteOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm Delete Alert */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Comment?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this comment by{" "}
              <strong>
                {selectedComment?.users?.user_name || selectedComment?.users?.name || `User #${selectedComment?.user_id}`}
              </strong>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Comment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
