"use client"

import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/providers/AuthProvider"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { toast } from "sonner"

type ProviderRequest = {
  request_id: number
  business_name: string | null
  contact_number: string | null
  business_registration_number: string | null
  proof_of_ownership_url: string | null
  status: string
  reason: string | null
  email_sent_at: string | null
  created_at: string
  users: { name: string; surname: string; email: string } | null
  pet_friendly_places: { name: string } | null
}

export function ProviderRequests({ onApproved }: { onApproved?: () => void }) {
  const { session } = useAuth()
  const [open, setOpen] = useState(false)
  const [requests, setRequests] = useState<ProviderRequest[]>([])
  const [selected, setSelected] = useState<ProviderRequest | null>(null)
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState("all")
  const token = session?.access_token
  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError("")
    try {
      const rows: ProviderRequest[] = []
      let page = 1
      let more = true
      while (more) {
        const response = await fetch(`/api/v1/provider-requests?page=${page}`, { headers: { Authorization: `Bearer ${token}` } })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || "Failed to load requests")
        rows.push(...body.requests)
        more = body.has_more
        page++
      }
      setRequests(rows)
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to load requests")
    } finally { setLoading(false) }
  }, [token])
  useEffect(() => { void load() }, [load])

  async function review(status: "approved" | "rejected") {
    if (!selected || !reason.trim()) return
    setSaving(true)
    try {
      const response = await fetch(`/api/v1/provider-requests?request_id=${selected.request_id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status, reason }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Failed to review request")
      if (body.warning) toast.warning(body.warning)
      else toast.success("Decision saved and email sent")
      setSelected(null)
      setReason("")
      await load()
      if (status === "approved") onApproved?.()
    } catch (error) { toast.error(error instanceof Error ? error.message : "Review failed") }
    finally { setSaving(false) }
  }

  return <>
    <button className="w-full rounded-lg border p-5 text-left hover:bg-muted/50 sm:w-64" onClick={() => setOpen(true)}>
      <span className="text-lg font-semibold">Requests</span>
      <p className="text-sm text-muted-foreground">{error ? "Unable to load requests" : loading ? "Loading..." : `${requests.filter(r => r.status === "pending").length} pending · ${requests.length} total`}</p>
    </button>
    <Dialog open={open} onOpenChange={value => { if (!saving) { setOpen(value); setSelected(null) } }}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Provider requests</DialogTitle><DialogDescription>Review ownership documents, then accept or reject with a reason emailed to the applicant.</DialogDescription></DialogHeader>
        {selected ? <div className="space-y-4">
          <Button variant="outline" disabled={saving} onClick={() => setSelected(null)}>Back to requests</Button>
          <h3 className="font-semibold">{selected.business_name || selected.pet_friendly_places?.name}</h3>
          <p>Applicant: {selected.users?.name} {selected.users?.surname} ({selected.users?.email || "Email unavailable"})</p>
          <p>Contact: {selected.contact_number || "Not provided"}</p>
          <p>Registration: {selected.business_registration_number || "Not provided"}</p>
          <p>Status: {selected.status}</p>
          {selected.proof_of_ownership_url && /^https:\/\//i.test(selected.proof_of_ownership_url) && <a className="text-primary underline" href={selected.proof_of_ownership_url} target="_blank" rel="noopener noreferrer">View proof of ownership</a>}
          <label className="block" htmlFor="provider-review-reason">Reason (sent to the user by email)</label>
          <Textarea id="provider-review-reason" maxLength={2000} value={reason} disabled={saving || selected.status !== "pending"} onChange={e => setReason(e.target.value)} />
          {selected.status === "pending" ? <div className="flex gap-2">
            <Button disabled={saving || !reason.trim()} onClick={() => review("approved")}>{saving ? "Saving..." : "Accept"}</Button>
            <Button variant="destructive" disabled={saving || !reason.trim()} onClick={() => review("rejected")}>Reject</Button>
          </div> : !selected.email_sent_at && <Button disabled={saving} onClick={() => review(selected.status as "approved" | "rejected")}>Retry decision email</Button>}
        </div> : <div className="space-y-4">
          <div className="flex gap-3"><select aria-label="Filter requests by status" className="rounded border p-2" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">All requests</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
          </select><Button variant="outline" disabled={loading} onClick={() => void load()}>Refresh</Button></div>
          {error && <p role="alert" className="text-destructive">{error}</p>}
          {loading ? <p>Loading requests...</p> : <>
            {!requests.filter(r => filter === "all" || r.status === filter).length && <p>No requests found.</p>}
            {requests.filter(r => filter === "all" || r.status === filter).map(r => <button key={r.request_id} className="flex w-full justify-between gap-4 rounded border p-4 text-left hover:bg-muted/50" onClick={() => { setSelected(r); setReason(r.reason || "") }}>
              <span><strong>{r.business_name || r.pet_friendly_places?.name || `Request #${r.request_id}`}</strong><span className="block text-sm">{r.users?.email} · {new Date(r.created_at).toLocaleDateString()}</span></span><span>{r.status}</span>
            </button>)}
          </>}
        </div>}
      </DialogContent>
    </Dialog>
  </>
}

