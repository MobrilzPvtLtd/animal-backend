"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { useAuth } from "@/providers/AuthProvider"
import { SupportTicket, SupportReply, TICKET_STATUSES, parseTicketMessage } from "./schema"
import { columns } from "./columns"
import { DataTable } from "../DataTable"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, MessageSquare, Send, Paperclip, ImageIcon, X, Search, Tag, User, Filter, RotateCcw, RefreshCw, AlertCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollableDialogContent } from "@/components/ui/scrollable-dialog"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { format } from "date-fns"
import Image from "next/image"

const statusStyles: Record<string, string> = {
  open: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-blue-100 text-blue-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-800",
}

const priorityStyles: Record<string, string> = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
}

export function SupportCrud() {
  const { session } = useAuth()
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [replyText, setReplyText] = useState("")
  const [replyFile, setReplyFile] = useState<File | null>(null)
  const replyFileInputRef = useRef<HTMLInputElement>(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [sendingReply, setSendingReply] = useState(false)

  // Search and Filter states
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedLabel, setSelectedLabel] = useState<string>("all")
  const [selectedUserId, setSelectedUserId] = useState<string>("all")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [selectedPriority, setSelectedPriority] = useState<string>("all")

  const authHeaders = (): HeadersInit => {
    if (session?.access_token) {
      return { Authorization: `Bearer ${session.access_token}` }
    }
    return {}
  }

  useEffect(() => {
    fetchTickets()
  }, [session?.access_token])

  const fetchTickets = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/v1/support?all=true", { headers: authHeaders() })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Failed to load tickets")
      setTickets(result.tickets || [])
    } catch (error) {
      console.error("Error fetching support tickets:", error)
      toast.error("Failed to load support tickets")
    } finally {
      setLoading(false)
    }
  }

  const openTicketDetail = async (ticket: SupportTicket) => {
    setSelectedTicket(null)
    setReplyFile(null)
    setIsDetailOpen(true)
    try {
      const response = await fetch(`/api/v1/support/${ticket.support_ticket_id}`, { headers: authHeaders() })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Failed to load ticket")
      setSelectedTicket(result.ticket)
    } catch (error) {
      console.error("Error fetching ticket detail:", error)
      toast.error("Failed to load ticket details")
      setIsDetailOpen(false)
    }
  }

  const handleStatusChange = async (ticketId: number, newStatus: string) => {
    setUpdatingStatus(true)
    try {
      const response = await fetch(`/api/v1/support/${ticketId}`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Failed to update status")
      toast.success(`Ticket status updated to ${newStatus.replace("_", " ")}`)
      if (selectedTicket) {
        setSelectedTicket({ ...selectedTicket, status: newStatus })
      }
      fetchTickets()
    } catch (error) {
      console.error("Error updating ticket status:", error)
      toast.error("Failed to update status")
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleSubmitReply = async () => {
    if (!selectedTicket || !replyText.trim() || sendingReply) return
    setSendingReply(true)
    try {
      let response: Response
      if (replyFile) {
        const formData = new FormData()
        formData.append("reply", replyText.trim())
        formData.append("file", replyFile)
        response = await fetch(`/api/v1/support/${selectedTicket.support_ticket_id}`, {
          method: "POST",
          headers: authHeaders(),
          body: formData,
        })
      } else {
        response = await fetch(`/api/v1/support/${selectedTicket.support_ticket_id}`, {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ reply: replyText.trim() }),
        })
      }
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Failed to send reply")
      
      if (result.emailSent) {
        toast.success(`Reply sent and emailed to ${result.emailRecipient || "user"}`)
      } else if (result.emailError) {
        toast.success("Reply posted, but email notification failed to send")
      } else {
        toast.success("Reply sent successfully")
      }

      setReplyText("")
      setReplyFile(null)
      if (replyFileInputRef.current) replyFileInputRef.current.value = ""
      openTicketDetail(selectedTicket)
      fetchTickets()
    } catch (error: any) {
      console.error("Error sending reply:", error)
      toast.error(error.message || "Failed to send reply")
    } finally {
      setSendingReply(false)
    }
  }

  // Dynamic list of unique labels/categories from tickets
  const availableLabels = useMemo(() => {
    const set = new Set<string>()
    ;["General Inquiry", "Billing/Subscription", "Provider Support", "Technical Issue"].forEach((c) =>
      set.add(c)
    )
    tickets.forEach((t) => {
      const { category } = parseTicketMessage(t.initial_message)
      if (category) set.add(category)
    })
    return Array.from(set).sort()
  }, [tickets])

  // Dynamic list of unique users who logged tickets
  const availableUsers = useMemo(() => {
    const userMap = new Map<string, { id: string; name: string; email: string; count: number }>()
    tickets.forEach((t) => {
      if (t.users) {
        const key = String(t.users.user_id || t.users.email)
        const existing = userMap.get(key)
        const fullName = `${t.users.name || ""} ${t.users.surname || ""}`.trim()
        if (existing) {
          existing.count += 1
        } else {
          userMap.set(key, {
            id: key,
            name: fullName || t.users.email,
            email: t.users.email,
            count: 1,
          })
        }
      }
    })
    return Array.from(userMap.values()).sort((a, b) => b.count - a.count)
  }, [tickets])

  const guestTicketCount = useMemo(() => {
    return tickets.filter((t) => !t.users).length
  }, [tickets])

  // Comprehensive filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      const { category, cleanMessage } = parseTicketMessage(ticket.initial_message)
      const term = searchTerm.toLowerCase().trim()

      const userFullName = ticket.users
        ? `${ticket.users.name || ""} ${ticket.users.surname || ""}`.toLowerCase()
        : ""
      const userEmail = ticket.users?.email?.toLowerCase() || ""
      const ticketIdStr = String(ticket.support_ticket_id)
      const categoryStr = (category || "").toLowerCase()
      const subjectStr = (ticket.subject || "").toLowerCase()
      const messageStr = (cleanMessage || "").toLowerCase()
      const statusStr = (ticket.status || "").toLowerCase()
      const priorityStr = (ticket.priority || "").toLowerCase()

      // 1. Free-text search matches Subject, Label, User name, User email, Ticket ID, message body, status, priority
      const matchesSearch =
        !term ||
        subjectStr.includes(term) ||
        categoryStr.includes(term) ||
        userFullName.includes(term) ||
        userEmail.includes(term) ||
        ticketIdStr === term.replace(/^#/, "") ||
        ticketIdStr.includes(term.replace(/^#/, "")) ||
        messageStr.includes(term) ||
        statusStr.includes(term) ||
        priorityStr.includes(term)

      // 2. Label / Category filter
      const matchesLabel =
        selectedLabel === "all" ||
        (selectedLabel === "uncategorized" && !category) ||
        (category && category.toLowerCase() === selectedLabel.toLowerCase())

      // 3. User filter
      const matchesUser =
        selectedUserId === "all" ||
        (selectedUserId === "guest" && !ticket.users) ||
        (ticket.users &&
          (String(ticket.users.user_id) === selectedUserId || ticket.users.email === selectedUserId))

      // 4. Status filter
      const matchesStatus =
        selectedStatus === "all" || ticket.status === selectedStatus

      // 5. Priority filter
      const matchesPriority =
        selectedPriority === "all" || ticket.priority === selectedPriority

      return matchesSearch && matchesLabel && matchesUser && matchesStatus && matchesPriority
    })
  }, [tickets, searchTerm, selectedLabel, selectedUserId, selectedStatus, selectedPriority])

  const counts = useMemo(() => {
    return {
      total: tickets.length,
      open: tickets.filter((t) => t.status === "open").length,
      inProgress: tickets.filter((t) => t.status === "in_progress").length,
      resolved: tickets.filter((t) => t.status === "resolved").length,
      closed: tickets.filter((t) => t.status === "closed").length,
    }
  }, [tickets])

  const isFiltered = Boolean(
    searchTerm ||
      selectedLabel !== "all" ||
      selectedUserId !== "all" ||
      selectedStatus !== "all" ||
      selectedPriority !== "all"
  )

  const handleResetFilters = () => {
    setSearchTerm("")
    setSelectedLabel("all")
    setSelectedUserId("all")
    setSelectedStatus("all")
    setSelectedPriority("all")
  }

  const enhancedColumns = [
    ...columns,
    {
      id: "view",
      cell: ({ row }: { row: any }) => {
        const ticket = row.original as SupportTicket
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openTicketDetail(ticket)}
          >
            View
          </Button>
        )
      },
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Support Tickets</h2>
          <p className="text-sm text-muted-foreground">Manage and respond to user assistance inquiries.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchTickets} disabled={loading} className="gap-1.5">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Advanced Search & Filtering Engine */}
      <div className="bg-muted/40 p-4 rounded-xl border space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
          {/* Universal Search Input */}
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by subject, label, user name, email, or #ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-8 bg-background"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Label / Category Filter Dropdown */}
          <div className="w-full sm:w-[220px]">
            <Select value={selectedLabel} onValueChange={setSelectedLabel}>
              <SelectTrigger className="bg-background">
                <div className="flex items-center gap-2 truncate">
                  <Tag className="h-3.5 w-3.5 text-indigo-600 flex-shrink-0" />
                  <SelectValue placeholder="All Labels" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Labels / Categories</SelectItem>
                {availableLabels.map((label) => (
                  <SelectItem key={label} value={label}>
                    {label}
                  </SelectItem>
                ))}
                <SelectItem value="uncategorized">Uncategorized</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* User Filter Dropdown */}
          <div className="w-full sm:w-[240px]">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="bg-background">
                <div className="flex items-center gap-2 truncate">
                  <User className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
                  <SelectValue placeholder="All Users" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users ({tickets.length} tickets)</SelectItem>
                {availableUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} ({u.count} {u.count === 1 ? "ticket" : "tickets"})
                  </SelectItem>
                ))}
                {guestTicketCount > 0 && (
                  <SelectItem value="guest">
                    Anonymous / Guest ({guestTicketCount} tickets)
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter Dropdown */}
          <div className="w-full sm:w-[170px]">
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="bg-background">
                <div className="flex items-center gap-2 truncate">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <SelectValue placeholder="All Statuses" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Priority Filter Dropdown */}
          <div className="w-full sm:w-[160px]">
            <Select value={selectedPriority} onValueChange={setSelectedPriority}>
              <SelectTrigger className="bg-background">
                <div className="flex items-center gap-2 truncate">
                  <AlertCircle className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <SelectValue placeholder="All Priorities" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Status Counters & Active Filter Notice */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-muted-foreground border-t border-slate-200/60">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-700">Quick Stats:</span>
            <Badge variant="outline" className="text-xs bg-background">
              Total: {counts.total}
            </Badge>
            <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-800 border-yellow-200">
              Open: {counts.open}
            </Badge>
            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-800 border-blue-200">
              In Progress: {counts.inProgress}
            </Badge>
            <Badge variant="outline" className="text-xs bg-green-50 text-green-800 border-green-200">
              Resolved: {counts.resolved}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <span>
              Showing <strong className="text-foreground">{filteredTickets.length}</strong> of {tickets.length} tickets
            </span>
            {isFiltered && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-6 text-xs px-2 text-primary hover:text-primary/80 gap-1"
              >
                <RotateCcw className="h-3 w-3" />
                Reset filters
              </Button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <DataTable
          columns={enhancedColumns}
          data={filteredTickets}
          hideToolbar={true}
        />
      )}

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <ScrollableDialogContent className="sm:max-w-[700px] max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>
              {selectedTicket ? selectedTicket.subject : "Ticket Details"}
            </DialogTitle>
            <DialogDescription>
              View and respond to this support ticket.
            </DialogDescription>
          </DialogHeader>

          {selectedTicket ? (() => {
            const { category, cleanMessage } = parseTicketMessage(selectedTicket.initial_message)
            return (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 items-center">
                <Badge className={statusStyles[selectedTicket.status] || ""}>
                  {selectedTicket.status.replace("_", " ")}
                </Badge>
                <Badge variant="outline" className={priorityStyles[selectedTicket.priority] || ""}>
                  {selectedTicket.priority}
                </Badge>
                {category && (
                  <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-50 font-medium">
                    Category: {category}
                  </Badge>
                )}
                <div className="text-sm text-muted-foreground ml-auto">
                  {format(new Date(selectedTicket.created_at), "MMM d, yyyy HH:mm")}
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">From:</span>
                <span className="font-medium text-foreground">
                  {selectedTicket.users
                    ? `${selectedTicket.users.name || ""} ${selectedTicket.users.surname || ""}`.trim() || selectedTicket.users.email
                    : "Unknown"}
                </span>
                {selectedTicket.users?.email && (
                  <span className="text-muted-foreground text-xs">({selectedTicket.users.email})</span>
                )}
              </div>

              <div className="bg-muted/70 rounded-lg p-4 space-y-3 border">
                {category && (
                  <div className="flex items-center gap-2 pb-2.5 border-b border-border/60">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category:</span>
                    <span className="text-xs font-medium text-indigo-800 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                      {category}
                    </span>
                  </div>
                )}
                <p className="text-sm whitespace-pre-wrap text-foreground">
                  {cleanMessage || <span className="text-muted-foreground italic">(No additional text)</span>}
                </p>
                {selectedTicket.image_url && (
                  <div className="mt-2 relative rounded-lg overflow-hidden border max-w-sm">
                    <Image
                      src={selectedTicket.image_url}
                      alt="Attached image"
                      width={400}
                      height={300}
                      className="object-cover w-full h-auto"
                      style={{ maxHeight: 200 }}
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Status:</label>
                <Select
                  value={selectedTicket.status}
                  onValueChange={(value) => handleStatusChange(selectedTicket.support_ticket_id, value)}
                  disabled={updatingStatus}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TICKET_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium">Replies</h4>
                {selectedTicket.support_replies && selectedTicket.support_replies.length > 0 ? (
                  selectedTicket.support_replies.map((reply: SupportReply) => (
                    <div key={reply.support_reply_id} className="bg-accent rounded-lg p-4 ml-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(reply.created_at), "MMM d, yyyy HH:mm")}
                        </span>
                        <span className="text-xs font-medium">
                          {reply.users
                            ? `${reply.users.name || ""} ${reply.users.surname || ""}`.trim() || reply.users.email
                            : "Staff"}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{reply.reply}</p>
                      {reply.image_url && (
                        <div className="mt-2 relative rounded-lg overflow-hidden border max-w-sm">
                          <Image
                            src={reply.image_url}
                            alt="Reply image"
                            width={400}
                            height={300}
                            className="object-cover w-full h-auto"
                            style={{ maxHeight: 200 }}
                          />
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No replies yet.</p>
                )}
              </div>

              {selectedTicket.status !== "closed" && (
                <div className="space-y-2">
                  <Textarea
                    placeholder="Type your reply..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={3}
                  />
                  <div className="flex items-center justify-between">
                    <div>
                      <input
                        type="file"
                        ref={replyFileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => setReplyFile(e.target.files?.[0] || null)}
                      />
                      {replyFile ? (
                        <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 px-3 py-1.5 rounded-md w-fit">
                          <ImageIcon className="h-4 w-4" />
                          <span className="truncate max-w-[150px]">{replyFile.name}</span>
                          <button onClick={() => { setReplyFile(null); if (replyFileInputRef.current) replyFileInputRef.current.value = ""; }}>
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <Button type="button" variant="outline" size="sm" onClick={() => replyFileInputRef.current?.click()}>
                          <Paperclip className="h-4 w-4 mr-1" />
                          Attach Image
                        </Button>
                      )}
                    </div>
                    <Button onClick={handleSubmitReply} disabled={!replyText.trim() || sendingReply}>
                      {sendingReply ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Sending Reply...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Send Reply
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
            )
          })() : (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
        </ScrollableDialogContent>
      </Dialog>
    </div>
  )
}
