// Thin wrapper around the SAM.gov v2 opportunities search. Requires
// SAM_GOV_API_KEY in env. Returns the most recent N opportunities matching
// the supplied keyword string within the last `daysBack` days.

export interface Opportunity {
  title: string;
  solicitationNumber: string;
  agency: string;
  postedDate: string;
  responseDeadLine: string;
  naicsCode: string;
  type: string;
  uiLink: string;
  description: string;
}

export async function searchOpportunities(keywords: string, daysBack = 90): Promise<Opportunity[]> {
  const apiKey = process.env.SAM_GOV_API_KEY;
  if (!apiKey) throw new Error('SAM_GOV_API_KEY not configured');

  // SAM.gov expects MM/DD/YYYY for postedFrom/postedTo. ISO yyyy-mm-dd ->
  // mm/dd/yyyy.
  const fmt = (d: Date) => {
    const iso = d.toISOString().slice(0, 10); // yyyy-mm-dd
    const [y, m, day] = iso.split('-');
    return `${m}/${day}/${y}`;
  };

  const postedFrom = fmt(new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000));
  const postedTo = fmt(new Date());

  const params = new URLSearchParams({
    api_key: apiKey,
    q: keywords,
    limit: '25',
    postedFrom,
    postedTo,
  });

  const res = await fetch(`https://api.sam.gov/opportunities/v2/search?${params}`);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`SAM.gov error: ${res.status}${body ? ' — ' + body.slice(0, 200) : ''}`);
  }
  const data = (await res.json()) as { opportunitiesData?: any[] };

  return (data.opportunitiesData || []).map((o: any) => ({
    title: o.title ?? '',
    solicitationNumber: o.solicitationNumber ?? '',
    agency: o.fullParentPathName ?? '',
    postedDate: o.postedDate ?? '',
    responseDeadLine: o.responseDeadLine ?? '',
    naicsCode: o.naicsCode ?? '',
    type: o.type ?? '',
    description: o.description ?? '',
    uiLink: o.uiLink ?? `https://sam.gov/opp/${o.noticeId}/view`,
  }));
}
