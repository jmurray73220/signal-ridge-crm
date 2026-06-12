/**
 * One-time backfill: format every existing contact's bio into the narrative +
 * Experience structure, the same way new/edited bios are now formatted on save.
 *
 * After this runs, the auto-format-on-save in contactsController handles all
 * future bios, so this script is a one-shot — not an ongoing feature.
 *
 * Usage (from crm/server):
 *   npx ts-node src/scripts/formatExistingBios.ts            # do it for real
 *   npx ts-node src/scripts/formatExistingBios.ts --dry-run  # preview counts only
 *
 * Requires ANTHROPIC_API_KEY and DATABASE_URL in the environment (.env). Note:
 * DATABASE_URL points at the live Railway Postgres, so this updates production.
 */

import dotenv from 'dotenv';
import prisma from '../services/prisma';
import { formatBio, shouldFormat, looksFormatted } from '../services/bioFormat';

dotenv.config();

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set — add it to crm/server/.env');
  }

  // Pull every non-deleted contact that has a bio. (The default prisma client
  // already excludes soft-deleted rows.)
  const contacts = await prisma.contact.findMany({
    where: { bio: { not: null } },
    select: { id: true, firstName: true, lastName: true, bio: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });

  const candidates = contacts.filter(c => shouldFormat(c.bio));
  const alreadyFormatted = contacts.filter(c => looksFormatted(c.bio)).length;
  const tooShort = contacts.length - candidates.length - alreadyFormatted;

  console.log('─── Bio backfill ───────────────────────────────────────────');
  console.log(`  contacts with a bio:   ${contacts.length}`);
  console.log(`  already formatted:     ${alreadyFormatted} (skipped)`);
  console.log(`  too short / notes:     ${tooShort} (skipped)`);
  console.log(`  to format:             ${candidates.length}`);
  console.log(DRY_RUN ? '  mode:                  DRY RUN (no writes)' : '  mode:                  LIVE (updating DB)');
  console.log('────────────────────────────────────────────────────────────');

  if (DRY_RUN || candidates.length === 0) return;

  let done = 0;
  let failed = 0;
  for (const c of candidates) {
    const label = `${c.firstName} ${c.lastName}`.trim();
    try {
      const formatted = await formatBio(c.bio as string);
      await prisma.contact.update({ where: { id: c.id }, data: { bio: formatted } });
      done++;
      console.log(`  ✓ [${done}/${candidates.length}] ${label}`);
    } catch (err) {
      failed++;
      console.warn(`  ✗ ${label}: ${(err as Error).message}`);
    }
    // Gentle pacing so a large backfill doesn't burst the API.
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('────────────────────────────────────────────────────────────');
  console.log(`  formatted: ${done}   failed: ${failed}`);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Backfill failed:', err);
    process.exit(1);
  });
