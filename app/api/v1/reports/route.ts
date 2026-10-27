import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server-supabase';
import { requireRoles } from '@/lib/server-auth';
import { buildReports, validateReportRange, ReportGroup, ReportInput } from '@/lib/reporting';

export const dynamic = 'force-dynamic';

// Fetch every page: Supabase's default row limit would silently undercount reports.
async function allRows<T>(table: string, columns: string, id: string, filter?: (query: any) => any): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    let query = supabaseAdmin.from(table).select(columns).order(id).range(offset, offset + 999);
    if (table === 'user_roles') query = query.order('role_id');
    if (filter) query = filter(query);
    const { data, error } = await query;
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data || []) as T[]);
    if (!data || data.length < 1000) break;
  }
  return rows;
}

export async function GET(request: NextRequest) {
  const auth = await requireRoles(request, ['Owner', 'Admin']);
  if ('status' in auth) return auth;
  const start = request.nextUrl.searchParams.get('start') || '';
  const end = request.nextUrl.searchParams.get('end') || '';
  const group = request.nextUrl.searchParams.get('group') || 'week';
  try { validateReportRange(start, end, group); }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
  try {
    const [users, providers, boosts, transactions, packages, locations, roleUsers] = await Promise.all([
      allRows<ReportInput['users'][number]>('users', 'user_id,created_at,subscription_status,subscription_expires_at,user_type,static_location', 'user_id', q => q.eq('is_deleted', false)),
      allRows<ReportInput['providers'][number]>('service_providers', 'service_provider_id,user_id,created_at,location_id', 'service_provider_id', q => q.eq('is_deleted', false)),
      allRows<ReportInput['boosts'][number]>('entity_boosts', 'entity_boost_id,boost_package_id,start_date,end_date,is_active,transaction_id', 'entity_boost_id'),
      allRows<ReportInput['transactions'][number]>('transactions', 'transaction_id,amount,created_at,subscription_plan_id,object', 'transaction_id', q => q.eq('status', 'completed').gte('created_at', `${start}T00:00:00.000Z`).lt('created_at', new Date(Date.parse(end) + 86400000).toISOString())),
      allRows<ReportInput['packages'][number]>('boost_packages', 'boost_package_id,name', 'boost_package_id'),
      allRows<ReportInput['locations'][number]>('locations', 'location_id,address', 'location_id'),
      allRows<{ user_id: number; roles: { name: string } | { name: string }[] | null }>('user_roles', 'user_id,roles!inner(name)', 'user_id'),
    ]);
    const providerRoleUsers = roleUsers.filter(row => {
      const roles = Array.isArray(row.roles) ? row.roles : [row.roles];
      return roles.some(role => ['provider', 'service provider', 'veterinarian', 'vet'].includes((role?.name || '').toLowerCase()));
    }).map(row => row.user_id);
    return NextResponse.json(buildReports({ users, providers, boosts, transactions, packages, locations, providerRoleUsers }, start, end, group as ReportGroup), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Reports query failed:', error);
    return NextResponse.json({ error: 'Reports could not be loaded. Please try again.' }, { status: 500 });
  }
}
