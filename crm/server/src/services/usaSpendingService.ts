// Thin wrapper around the public USASpending.gov "spending_by_award" search
// endpoint. No API key required. We pull the highest-dollar awards from the
// last three years matching the supplied keywords.

export interface Award {
  awardId: string;
  recipientName: string;
  awardAmount: number;
  description: string;
  awardingAgency: string;
  startDate: string;
  naicsCode?: string;
}

export async function searchAwards(keywords: string[], limit = 25): Promise<Award[]> {
  const today = new Date().toISOString().slice(0, 10);
  const threeYearsAgo = new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const res = await fetch('https://api.usaspending.gov/api/v2/search/spending_by_award/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filters: {
        keywords,
        // A: BPA Call, B: Purchase Order, C: Delivery Order, D: Definitive Contract.
        award_type_codes: ['A', 'B', 'C', 'D'],
        time_period: [{ start_date: threeYearsAgo, end_date: today }],
      },
      fields: [
        'Award ID', 'Recipient Name', 'Award Amount', 'Description',
        'Awarding Agency', 'Start Date', 'NAICS Code',
      ],
      limit,
      sort: 'Award Amount',
      order: 'desc',
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`USASpending error: ${res.status}${body ? ' — ' + body.slice(0, 200) : ''}`);
  }
  const data = (await res.json()) as { results?: any[] };

  return (data.results || []).map((r: any) => ({
    awardId: r['Award ID'] ?? '',
    recipientName: r['Recipient Name'] ?? '',
    awardAmount: r['Award Amount'] ?? 0,
    description: r['Description'] ?? '',
    awardingAgency: r['Awarding Agency'] ?? '',
    startDate: r['Start Date'] ?? '',
    naicsCode: r['NAICS Code'] ?? '',
  }));
}
