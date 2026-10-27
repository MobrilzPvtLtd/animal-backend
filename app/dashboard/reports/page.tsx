'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Download, RefreshCw } from 'lucide-react';
import { PROVINCES, ReportsData, ReportGroup, reportCsv, validateReportRange } from '@/lib/reporting';

// Keep geographic reports available for later activation, hidden for now.
const SHOW_LOCATION_REPORTS = false;
const money = (value: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(value);
type Column = { key: string; label: string; money?: boolean };
const subscriptionColumns: Column[] = [{ key: 'status', label: 'Subscription status' }, { key: 'users', label: 'Users' }, { key: 'serviceProviders', label: 'Provider accounts' }, { key: 'total', label: 'Total accounts' }];
const boosterColumns: Column[] = [{ key: 'type', label: 'Package type' }, { key: 'total', label: 'Purchased / assigned' }, { key: 'active', label: 'Active' }, { key: 'scheduled', label: 'Scheduled' }, { key: 'expired', label: 'Expired' }, { key: 'inactive', label: 'Inactive' }, { key: 'unknownDates', label: 'Unknown dates' }, { key: 'expiring', label: 'Expiring in 7 days' }];
const expiryColumns: Column[] = [{ key: 'id', label: 'Boost ID' }, { key: 'type', label: 'Package type' }, { key: 'ends', label: 'Ends (UTC)' }];
const revenueColumns: Column[] = [{ key: 'period', label: 'Period starting (UTC)' }, { key: 'subscriptions', label: 'Subscriptions', money: true }, { key: 'boosters', label: 'Boosters', money: true }, { key: 'other', label: 'Other / unclassified', money: true }, { key: 'revenue', label: 'Gross revenue', money: true }, { key: 'transactions', label: 'Payments' }];
const growthColumns: Column[] = [{ key: 'period', label: 'Period starting (UTC)' }, { key: 'newUsers', label: 'New users' }, { key: 'newProviders', label: 'New provider listings' }, { key: 'totalUsers', label: 'Cumulative users' }, { key: 'totalProviders', label: 'Cumulative provider listings' }];
const locationColumns: Column[] = [{ key: 'location', label: 'Recorded location' }, { key: 'province', label: 'Province' }, { key: 'users', label: 'Users' }, { key: 'serviceProviders', label: 'Provider listings' }, { key: 'total', label: 'Combined records' }];
const provinceColumns = locationColumns.filter(col => col.key !== 'location');

function ReportTable({ rows, columns }: { rows: Record<string, unknown>[]; columns: Column[] }) {
  return <div className="overflow-x-auto rounded-md border"><table className="w-full text-sm">
    <thead className="bg-muted/50"><tr>{columns.map(col => <th key={col.key} scope="col" className="p-3 text-left font-medium whitespace-nowrap">{col.label}</th>)}</tr></thead>
    <tbody>{rows.length ? rows.map((row, index) => <tr key={index} className="border-t">{columns.map(col => <td key={col.key} className="p-3">{col.money ? money(Number(row[col.key])) : String(row[col.key] ?? '')}</td>)}</tr>) : <tr><td className="p-6 text-center text-muted-foreground" colSpan={columns.length}>No records match this report.</td></tr>}</tbody>
  </table></div>;
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return <Card><CardHeader><CardTitle>{title}</CardTitle>{description && <p className="text-sm text-muted-foreground">{description}</p>}</CardHeader><CardContent>{children}</CardContent></Card>;
}

export default function ReportsPage() {
  const { session, loading: authLoading } = useAuth();
  const [range, setRange] = useState(() => ({ start: new Date(Date.now() - 89 * 86400000).toISOString().slice(0, 10), end: new Date().toISOString().slice(0, 10), group: 'week' as ReportGroup }));
  const [draft, setDraft] = useState(range);
  const [tab, setTab] = useState('subscriptions');
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterError, setFilterError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [province, setProvince] = useState('all');
  const [locationSort, setLocationSort] = useState('most');
  const [locationPage, setLocationPage] = useState(0);

  useEffect(() => {
    if (authLoading) return;
    if (!session?.access_token) { setLoading(false); setData(null); setError('Sign in to view reports.'); return; }
    const controller = new AbortController();
    setLoading(true); setError(''); setData(null);
    const query = new URLSearchParams(range);
    fetch(`/api/v1/reports?${query}`, { headers: { Authorization: `Bearer ${session.access_token}` }, signal: controller.signal, cache: 'no-store' })
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Reports could not be loaded.'); return result as ReportsData; })
      .then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(reason => { if (!controller.signal.aborted) setError(reason.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [authLoading, session?.access_token, range, refresh]);

  const locations = useMemo(() => [...(data?.locations || [])].filter(row => province === 'all' || row.province === province)
    .sort((a, b) => (locationSort === 'least' ? a.total - b.total : b.total - a.total) || a.location.localeCompare(b.location)), [data, province, locationSort]);
  useEffect(() => { setLocationPage(0); }, [province, locationSort, data]);

  const exportRows = (name: string, rows: Record<string, unknown>[], columns: Column[]) => {
    const csv = reportCsv(rows.map(row => Object.fromEntries(columns.map(col => [col.label, row[col.key]]))));
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = `${name}-${range.start}-${range.end}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };
  const exportCurrent = () => {
    if (!data) return;
    if (tab === 'subscriptions') exportRows('subscriptions-current', data.subscriptions, subscriptionColumns);
    if (tab === 'boosters') exportRows('boosters-current', data.boosters, boosterColumns);
    if (tab === 'revenue') exportRows('revenue', data.series, revenueColumns);
    if (tab === 'growth') exportRows('growth', data.series, growthColumns);
  };

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold">Reports</h1><p className="text-muted-foreground">Subscriptions, boosters, revenue and growth</p></div>
      <div className="flex gap-2"><Button variant="outline" onClick={() => setRefresh(value => value + 1)} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button><Button variant="outline" onClick={exportCurrent} disabled={!data || loading}><Download className="mr-2 h-4 w-4" />Export {tab === 'growth' ? 'growth' : 'report'}</Button></div>
    </div>
    <Card><CardContent className="pt-6 space-y-3">
      <form className="flex flex-wrap items-end gap-4" onSubmit={event => {
        event.preventDefault();
        try { validateReportRange(draft.start, draft.end, draft.group); setFilterError(''); setRange({ ...draft }); }
        catch (reason) { setFilterError((reason as Error).message); }
      }}>
        <div className="space-y-1 text-sm"><span id="quick-range-label">Quick range</span><Select onValueChange={value => { const end = new Date().toISOString().slice(0, 10); setDraft(previous => ({ ...previous, end, start: new Date(Date.parse(end) - (Number(value) - 1) * 86400000).toISOString().slice(0, 10) })); }}><SelectTrigger className="w-40" aria-labelledby="quick-range-label"><SelectValue placeholder="Choose range" /></SelectTrigger><SelectContent>{[7, 30, 90, 365].map(days => <SelectItem key={days} value={String(days)}>Last {days} days</SelectItem>)}</SelectContent></Select></div>
        <label className="space-y-1 text-sm">From (UTC)<Input required type="date" value={draft.start} onChange={e => setDraft({ ...draft, start: e.target.value })} /></label>
        <label className="space-y-1 text-sm">To (UTC)<Input required type="date" value={draft.end} onChange={e => setDraft({ ...draft, end: e.target.value })} /></label>
        <div className="space-y-1 text-sm"><span id="report-group-label">Group by</span><Select value={draft.group} onValueChange={group => setDraft({ ...draft, group: group as ReportGroup })}><SelectTrigger className="w-36" aria-labelledby="report-group-label"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="day">Daily</SelectItem><SelectItem value="week">Weekly</SelectItem><SelectItem value="month">Monthly</SelectItem></SelectContent></Select></div>
        <Button type="submit" disabled={loading}>Apply dates</Button>
      </form>
      <p className="text-xs text-muted-foreground">Dates filter Revenue and Growth only. Subscriptions and boosters show the current position. Weeks start Monday; boundary periods may be partial.</p>
      {filterError && <p role="alert" className="text-sm text-destructive">{filterError}</p>}
    </CardContent></Card>
    {loading && <p role="status">Loading reports…</p>}
    {error && <div role="alert" className="rounded-md border border-destructive p-4 text-destructive">{error}</div>}
    {data && !loading && <>
      <p className="text-xs text-muted-foreground">Updated {new Date(data.generatedAt).toLocaleString()} · Reporting period: {data.start} to {data.end} (UTC)</p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
        ['Registered users', data.summary.users.toLocaleString(), `${data.summary.newUsers} created in period`],
        ['Service provider listings', data.summary.serviceProviders.toLocaleString(), `${data.summary.newProviders} created in period, including veterinarians`],
        ['Active subscriptions', data.summary.activeSubscriptions.toLocaleString(), `${data.summary.activeBoosts} active boosts`],
        ['Gross revenue in period', money(data.summary.revenue), 'Completed transactions only'],
      ].map(([title, value, subtitle]) => <Card key={title}><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{title}</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{subtitle}</p></CardContent></Card>)}</div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex flex-wrap justify-start"><TabsTrigger value="subscriptions">Subscriptions</TabsTrigger><TabsTrigger value="boosters">Boosters</TabsTrigger><TabsTrigger value="revenue">Revenue</TabsTrigger><TabsTrigger value="growth">{SHOW_LOCATION_REPORTS ? 'Growth & Locations' : 'Growth'}</TabsTrigger></TabsList>
        <TabsContent value="subscriptions" className="space-y-4">
          <Section title="Subscriptions by status and account type" description="Each registered account appears once. Provider accounts have a provider role, provider user type, or own a provider listing. Other accounts appear under Users. Guest means a registered guest account; anonymous visitors are not tracked here.">
            <ReportTable rows={data.subscriptions} columns={subscriptionColumns} />
            <p className="mt-3 text-xs text-muted-foreground">Active excludes elapsed subscriptions. Cancelled includes cancellations with paid access remaining. Administrative access is not counted as a paid subscription. Deleted accounts are excluded.</p>
          </Section>
        </TabsContent>
        <TabsContent value="boosters" className="space-y-4">
          <Section title="Boosters by package type" description="Active boosts have started and have not ended. Expiring means an active boost ending in the next seven days."><ReportTable rows={data.boosters} columns={boosterColumns} /></Section>
          <Section title="Upcoming boost expirations"><div className="flex justify-end mb-3"><Button variant="outline" disabled={!data.expiringBoosts.length} onClick={() => exportRows('expiring-boosts', data.expiringBoosts, expiryColumns)}>Export expirations</Button></div><ReportTable rows={data.expiringBoosts} columns={expiryColumns} /></Section>
        </TabsContent>
        <TabsContent value="revenue" className="space-y-4">
          <Section title="Revenue over time" description="Gross completed payments in ZAR, grouped by transaction creation date. Pending, failed and cancelled payments are excluded. This does not calculate net revenue after fees or refunds.">
            <div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.series}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="period" minTickGap={40} /><YAxis /><Tooltip formatter={value => money(Number(value))} /><Legend /><Bar dataKey="subscriptions" name="Subscriptions" stackId="revenue" fill="#2563eb" /><Bar dataKey="boosters" name="Boosters" stackId="revenue" fill="#8b5cf6" /><Bar dataKey="other" name="Other / unclassified" stackId="revenue" fill="#94a3b8" /></BarChart></ResponsiveContainer></div>
            <ReportTable rows={data.series} columns={revenueColumns} />
          </Section>
        </TabsContent>
        <TabsContent value="growth" className="space-y-4">
          <Section title="User and service provider growth" description="Creations by period. Provider listings include veterinarians. Counts exclude currently deleted records, so historical totals reflect retained records rather than a historical account snapshot.">
            <div className="h-80"><ResponsiveContainer width="100%" height="100%"><LineChart data={data.series}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="period" minTickGap={40} /><YAxis allowDecimals={false} /><Tooltip /><Legend /><Line dataKey="newUsers" name="New users" stroke="#2563eb" dot={false} /><Line dataKey="newProviders" name="New provider listings" stroke="#16a34a" dot={false} /></LineChart></ResponsiveContainer></div>
            <ReportTable rows={data.series} columns={growthColumns} />
          </Section>
          {SHOW_LOCATION_REPORTS && <>
          <Section title="Province coverage" description="Current users and provider listings across all nine provinces. Zero counts help identify coverage gaps. Province names are matched from recorded addresses; unmatched or ambiguous addresses are unclassified, so zero does not prove an absence of activity.">
            <div className="flex justify-end mb-3"><Button variant="outline" onClick={() => exportRows('province-coverage-current', data.provinces, provinceColumns)}>Export provinces</Button></div><ReportTable rows={data.provinces} columns={provinceColumns} />
          </Section>
          <Section title="Most and least populated recorded locations" description="Ranked by recorded users plus provider listings, rather than visits or population. One person can own multiple listings. Saved addresses are grouped together when their text matches; different addresses in the same city remain separate.">
            <div className="flex flex-wrap gap-3 mb-4">
              <Select value={province} onValueChange={setProvince}><SelectTrigger className="w-56" aria-label="Filter locations by province"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All provinces</SelectItem>{[...PROVINCES, 'Unknown / unclassified'].map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent></Select>
              <Select value={locationSort} onValueChange={setLocationSort}><SelectTrigger className="w-48" aria-label="Location sort order"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="most">Most records first</SelectItem><SelectItem value="least">Fewest records first</SelectItem></SelectContent></Select>
              <Button variant="outline" disabled={!locations.length} onClick={() => exportRows('locations-current', locations, locationColumns)}>Export filtered locations</Button>
            </div>
            <ReportTable rows={locations.slice(locationPage * 25, (locationPage + 1) * 25)} columns={locationColumns} />
            <div className="flex items-center justify-between gap-2 mt-3 text-sm"><span>{locations.length} locations · Page {locationPage + 1} of {Math.max(1, Math.ceil(locations.length / 25))}</span><div className="flex gap-2"><Button variant="outline" disabled={locationPage === 0} onClick={() => setLocationPage(page => page - 1)}>Previous</Button><Button variant="outline" disabled={(locationPage + 1) * 25 >= locations.length} onClick={() => setLocationPage(page => page + 1)}>Next</Button></div></div>
          </Section>
          </>}
        </TabsContent>
      </Tabs>
    </>}
  </div>;
}
