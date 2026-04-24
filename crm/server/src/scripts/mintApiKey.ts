/**
 * Mint a new bot API key.
 *
 * Usage:
 *   npm run mint:key -- --label bubba [--role Admin|Editor|Viewer] [--email bubba+bot@signalridge.local]
 *
 * The plaintext key is printed ONCE. We store only its SHA-256 hash.
 * Re-running with the same label mints an additional key (does not rotate);
 * to rotate, revoke the old one in the DB (set revokedAt) and mint a new one.
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { rawPrisma as prisma } from '../services/prisma';

dotenv.config();

type Args = { label: string; role: 'Admin' | 'Editor' | 'Viewer'; email: string };

function parseArgs(argv: string[]): Args {
  const out: Partial<Args> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--label') out.label = argv[++i];
    else if (a === '--role') out.role = argv[++i] as Args['role'];
    else if (a === '--email') out.email = argv[++i];
  }
  if (!out.label) throw new Error('--label is required (e.g. --label bubba)');
  const role = out.role || 'Editor';
  if (!['Admin', 'Editor', 'Viewer'].includes(role)) {
    throw new Error(`--role must be Admin, Editor, or Viewer (got ${role})`);
  }
  const email = out.email || `${out.label.toLowerCase()}+bot@signalridge.local`;
  return { label: out.label, role, email };
}

function sha256Hex(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function generateKey(): string {
  // 32 bytes → 43-char base64url. Prefix identifies class of credential.
  const rand = crypto.randomBytes(32).toString('base64url');
  return `srk_live_${rand}`;
}

async function ensureBotUser(email: string, label: string, role: Args['role']) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;

  // Random unusable password — the bot never logs in via the web UI.
  const randomPassword = crypto.randomBytes(32).toString('base64url');
  const passwordHash = await bcrypt.hash(randomPassword, 10);

  return prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: label,
      lastName: '(bot)',
      role,
      isActive: true,
      mustChangePassword: false,
    },
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const plaintext = generateKey();
  const keyHash = sha256Hex(plaintext);
  const keyPrefix = plaintext.slice(0, 12);

  const user = await ensureBotUser(args.email, args.label, args.role);

  const apiKey = await prisma.apiKey.create({
    data: {
      label: args.label,
      keyHash,
      keyPrefix,
      userId: user.id,
    },
  });

  console.log('');
  console.log('─── API key minted ──────────────────────────────────────────');
  console.log(`  label:      ${apiKey.label}`);
  console.log(`  key id:     ${apiKey.id}`);
  console.log(`  bot user:   ${user.email} (${user.role})`);
  console.log(`  key prefix: ${apiKey.keyPrefix}…`);
  console.log('');
  console.log('  PLAINTEXT KEY (shown ONCE — copy it now):');
  console.log('');
  console.log(`    ${plaintext}`);
  console.log('');
  console.log('  Usage:');
  console.log(`    curl -H "Authorization: Bearer ${plaintext}" https://<host>/api/bot/health`);
  console.log('─────────────────────────────────────────────────────────────');
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Mint failed:', err);
    process.exit(1);
  });
