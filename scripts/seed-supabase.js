const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables from .env.local if present
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('\x1b[31mError: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local\x1b[0m');
  console.log('Example:');
  console.log('NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co');
  console.log('SUPABASE_SERVICE_ROLE_KEY=your-service-role-secret-key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  const jsonPath = path.join(process.cwd(), 'public', 'certificates.json');
  if (!fs.existsSync(jsonPath)) {
    console.error(`Error: File not found at ${jsonPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(jsonPath, 'utf-8');
  const certificates = JSON.parse(raw);
  console.log(`\x1b[34m[SEED]\x1b[0m Read ${certificates.length} certificates from ${jsonPath}`);

  const rows = certificates.map((c) => ({
    id: c.id,
    name: c.name,
    email: (c.email || '').toLowerCase().trim(),
    type: c.type || (c.id.startsWith('VOL') ? 'volunteer' : 'participant'),
    file_url: c.fileUrl || c.certificateUrl || `/certificates/${c.id}.png`,
    certificate_url: c.certificateUrl || c.fileUrl || `/certificates/${c.id}.png`,
    filename: c.filename || `${c.id}.png`,
    organization: c.organization || 'TeamCodeLocked',
    college: c.college || 'B.M.S. College of Engineering',
    event: c.event || 'Club Orientation 2026',
    partner: c.partner || 'BitByBit',
    partner_url: c.partnerUrl || 'https://bitbybit-9h8e.vercel.app',
    email_sent: Boolean(c.emailSent),
    email_sent_at: c.emailSentAt || null,
    email_count: c.emailCount || 0,
    last_sent_by: c.lastSentBy || null,
  }));

  // Batch insert in chunks of 50
  const chunkSize = 50;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from('certificates').upsert(chunk, { onConflict: 'id' });

    if (error) {
      console.error(`\x1b[31m[ERROR]\x1b[0m Failed chunk ${i}-${i + chunk.length}:`, error.message);
    } else {
      inserted += chunk.length;
      console.log(`\x1b[32m[SUCCESS]\x1b[0m Upserted records ${inserted}/${rows.length}`);
    }
  }

  console.log(`\n\x1b[32m✓ Completed migration to Supabase! Total records: ${inserted}\x1b[0m`);
}

seed().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
