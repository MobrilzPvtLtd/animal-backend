export type ReportGroup = 'day' | 'week' | 'month';
export type ReportUser = {
  user_id: number; created_at: string; subscription_status: string | null;
  subscription_expires_at: string | null; user_type: string | null; static_location: string | null;
};
export type ReportProvider = {
  service_provider_id: number; user_id: number | null; created_at: string;
  address?: string | null; location_id: number | null;
};
export type ReportBoost = {
  entity_boost_id: number; boost_package_id: number | null; start_date: string | null;
  end_date: string | null; is_active: boolean; transaction_id: number | null;
};
export type ReportTransaction = {
  transaction_id: number; amount: number | string; created_at: string;
  subscription_plan_id: number | null; object: Record<string, unknown> | null;
};
export type ReportInput = {
  users: ReportUser[]; providers: ReportProvider[]; boosts: ReportBoost[];
  transactions: ReportTransaction[]; packages: { boost_package_id: number; name: string }[];
  providerRoleUsers: number[]; locations: { location_id: number; address: string }[];
};

const DAY = 86400000;
export const PROVINCES = ['Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape'];

export function validateReportRange(start: string, end: string, group: string) {
  const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (!validDate(start) || !validDate(end)) throw new Error('Enter valid start and end dates.');
  const days = (Date.parse(end) - Date.parse(start)) / DAY;
  if (days < 0 || days > 3660) throw new Error('Choose an ordered date range of up to 10 years.');
  if (!['day', 'week', 'month'].includes(group)) throw new Error('Choose daily, weekly or monthly grouping.');
}

function bucket(date: string, group: ReportGroup) {
  const d = new Date(date);
  if (group === 'month') d.setUTCDate(1);
  if (group === 'week') d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
  return d.toISOString().slice(0, 10);
}

export function provinceFor(address: string | null | undefined): string {
  const normalized = (address || '').toLowerCase().replace(/[^a-z]+/g, ' ').trim();
  const aliases: [string, string[]][] = PROVINCES.map(name => [name, [name.toLowerCase().replace(/-/g, ' ')]]);
  aliases[3][1].push('kwazulu natal', 'kwazulu natal province', 'kzn');
  aliases[6][1].push('northwest');
  const matches = aliases.filter(([, names]) => names.some(name => (` ${normalized} `).includes(` ${name} `)));
  return matches.length === 1 ? matches[0][0] : 'Unknown / unclassified';
}

export function subscriptionStatus(user: ReportUser, now: Date) {
  const status = (user.subscription_status || 'guest').toLowerCase().trim();
  if (status === 'cancelled' || status === 'canceled') return 'Cancelled';
  if (['active', 'subscribed', 'paid', 'true'].includes(status)) {
    return user.subscription_expires_at && new Date(user.subscription_expires_at) <= now ? 'Expired' : 'Active';
  }
  if (status === 'guest') return 'Guest';
  return status === 'expired' ? 'Expired' : 'Other';
}

export function boostStatus(boost: ReportBoost, now: Date) {
  if (!boost.is_active) return 'Inactive';
  const start = boost.start_date ? Date.parse(boost.start_date) : NaN;
  const end = boost.end_date ? Date.parse(boost.end_date) : NaN;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 'Unknown dates';
  if (end <= now.getTime()) return 'Expired';
  return start > now.getTime() ? 'Scheduled' : 'Active';
}

export function buildReports(input: ReportInput, start: string, end: string, group: ReportGroup, now = new Date()) {
  validateReportRange(start, end, group);
  const from = Date.parse(start), until = Date.parse(end) + DAY;
  const providerAccounts = new Set(input.providerRoleUsers.map(String));
  input.providers.forEach(p => { if (p.user_id != null) providerAccounts.add(String(p.user_id)); });
  const subscriptions = ['Active', 'Cancelled', 'Guest', 'Expired', 'Other'].map(status => ({ status, users: 0, serviceProviders: 0, total: 0 }));
  input.users.forEach(user => {
    const row = subscriptions.find(row => row.status === subscriptionStatus(user, now))!;
    const isProvider = providerAccounts.has(String(user.user_id)) || ['provider', 'service_provider', 'veterinarian', 'vet'].includes((user.user_type || '').toLowerCase());
    row[isProvider ? 'serviceProviders' : 'users']++;
    row.total++;
  });

  const packageNames = new Map(input.packages.map(p => [String(p.boost_package_id), p.name]));
  const boosterTypes = new Map<string, { type: string; total: number; active: number; scheduled: number; expired: number; inactive: number; unknownDates: number; expiring: number }>();
  const expiringBoosts: { id: number; type: string; ends: string }[] = [];
  input.boosts.forEach(boost => {
    const type = packageNames.get(String(boost.boost_package_id)) || 'Unknown package';
    if (!boosterTypes.has(type)) boosterTypes.set(type, { type, total: 0, active: 0, scheduled: 0, expired: 0, inactive: 0, unknownDates: 0, expiring: 0 });
    const row = boosterTypes.get(type)!;
    row.total++;
    const status = boostStatus(boost, now);
    const key = { Active: 'active', Scheduled: 'scheduled', Expired: 'expired', Inactive: 'inactive', 'Unknown dates': 'unknownDates' }[status] as 'active' | 'scheduled' | 'expired' | 'inactive' | 'unknownDates';
    row[key]++;
    if (status === 'Active' && Date.parse(boost.end_date!) <= now.getTime() + 7 * DAY) {
      row.expiring++;
      expiringBoosts.push({ id: boost.entity_boost_id, type, ends: boost.end_date! });
    }
  });

  const periods = new Map<string, { period: string; newUsers: number; newProviders: number; totalUsers: number; totalProviders: number; subscriptions: number; boosters: number; other: number; revenue: number; transactions: number }>();
  for (let day = from; day < until; day += DAY) {
    const period = bucket(new Date(day).toISOString(), group);
    if (!periods.has(period)) periods.set(period, { period, newUsers: 0, newProviders: 0, totalUsers: 0, totalProviders: 0, subscriptions: 0, boosters: 0, other: 0, revenue: 0, transactions: 0 });
  }
  let baselineUsers = 0, baselineProviders = 0;
  for (const [records, key] of [[input.users, 'newUsers'], [input.providers, 'newProviders']] as const) {
    records.forEach(record => {
      const date = Date.parse(record.created_at);
      if (date < from) { if (key === 'newUsers') baselineUsers++; else baselineProviders++; }
      if (date >= from && date < until) periods.get(bucket(record.created_at, group))![key]++;
    });
  }
  const boostTransactions = new Set(input.boosts.filter(b => b.transaction_id != null).map(b => String(b.transaction_id)));
  input.transactions.forEach(txn => {
    const date = Date.parse(txn.created_at);
    if (date < from || date >= until || !Number.isFinite(date)) return;
    const amount = Number(txn.amount);
    if (!Number.isFinite(amount)) throw new Error('A completed transaction has an invalid amount.');
    const paymentType = String(txn.object?.payment_type || txn.object?.custom_str1 || '').toUpperCase();
    const kind = boostTransactions.has(String(txn.transaction_id)) || paymentType === 'BOOST' || txn.object?.boost_package_id
      ? 'boosters' : txn.subscription_plan_id || txn.object?.subscription_plan_id || txn.object?.plan_id ? 'subscriptions' : 'other';
    const row = periods.get(bucket(txn.created_at, group))!;
    // Sum integer cents; convert only when producing the response.
    row[kind] += Math.round(amount * 100);
    row.revenue += Math.round(amount * 100);
    row.transactions++;
  });
  const series = Array.from(periods.values()).map(row => {
    baselineUsers += row.newUsers; baselineProviders += row.newProviders;
    return { ...row, totalUsers: baselineUsers, totalProviders: baselineProviders, subscriptions: row.subscriptions / 100, boosters: row.boosters / 100, other: row.other / 100, revenue: row.revenue / 100 };
  });

  const provinces = [...PROVINCES, 'Unknown / unclassified'].map(province => ({ province, users: 0, serviceProviders: 0, total: 0 }));
  const locationAddresses = new Map(input.locations.map(l => [String(l.location_id), l.address]));
  const places = new Map<string, { location: string; province: string; users: number; serviceProviders: number; total: number }>();
  const addLocation = (address: string | null | undefined, kind: 'users' | 'serviceProviders') => {
    const province = provinceFor(address);
    const row = provinces.find(p => p.province === province)!;
    row[kind]++; row.total++;
    const label = address?.trim().replace(/\s+/g, ' ') || 'No recorded location';
    const key = label.toLowerCase();
    if (!places.has(key)) places.set(key, { location: label, province, users: 0, serviceProviders: 0, total: 0 });
    const place = places.get(key)!; place[kind]++; place.total++;
  };
  input.users.forEach(u => addLocation(u.static_location, 'users'));
  input.providers.forEach(p => addLocation(locationAddresses.get(String(p.location_id)) || p.address, 'serviceProviders'));
  return {
    generatedAt: now.toISOString(), start, end, group,
    summary: {
      users: input.users.length, serviceProviders: input.providers.length,
      activeSubscriptions: subscriptions[0].total,
      activeBoosts: Array.from(boosterTypes.values()).reduce((sum, row) => sum + row.active, 0),
      revenue: Math.round(series.reduce((sum, row) => sum + Math.round(row.revenue * 100), 0)) / 100,
      newUsers: series.reduce((sum, row) => sum + row.newUsers, 0),
      newProviders: series.reduce((sum, row) => sum + row.newProviders, 0),
    },
    subscriptions, boosters: Array.from(boosterTypes.values()).sort((a, b) => b.active - a.active),
    expiringBoosts: expiringBoosts.sort((a, b) => a.ends.localeCompare(b.ends)), series,
    provinces: provinces.sort((a, b) => b.total - a.total),
    locations: Array.from(places.values()).sort((a, b) => b.total - a.total || a.location.localeCompare(b.location)),
  };
}

export type ReportsData = ReturnType<typeof buildReports>;

export function reportCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return '';
  const columns = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    let text = String(value ?? '');
    if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  };
  return [columns.map(escape).join(','), ...rows.map(row => columns.map(key => escape(row[key])).join(','))].join('\r\n');
}
