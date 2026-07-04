// One-off bulk importer for RGW risk/COSHH assessment PDFs into the live site-documents system.
// Usage: node scripts/import-site-documents.mjs "<folder path>"
//
// Runs LOCALLY against production using the service-role key from .env.local.
// The service-role key is never printed.

import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

// ---- Constants ----
const COMPANY_ID = 'ee7c4367-f6c8-4f73-a98b-8dda7b4ba1fc';
const SITE_ID = '74b69fbf-7ab3-432c-abaa-a7803e95bcb9';
const BUCKET = 'site-documents';
const REVIEW_DATE = '2025-11-01';
const UPLOADED_BY = 'Rigby and Rigby';
const IMPORT_STATUS = 'approved';

// ---- Small helpers ----
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Minimal .env.local parser (dotenv is not installed in this project).
function loadEnvLocal() {
  const envPath = resolve(process.cwd(), '.env.local');
  let raw;
  try {
    raw = readFileSync(envPath, 'utf8');
  } catch {
    console.error('Could not read .env.local at', envPath);
    process.exit(1);
  }
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    // Strip any surrounding quote characters (handles unbalanced/doubled quotes
    // from a mangled paste, e.g. `""sb_secret_...`). Supabase keys never contain quotes.
    val = val.replace(/^["']+|["']+$/g, '');
    env[key] = val;
  }
  return env;
}

// Filename patterns.
//   Risk:      "RA RGW 01-001 revH - Working at height.pdf"
//   COSHH:     "COSHH 1F revB - Cement and cement products.pdf"
//   Procedure: "RGW F1 - Title.pdf" / "RGW F2 14.0 - Title.pdf"
//              ref_code = everything before " - " (e.g. "RGW F1", "RGW F2 14.0"); revision null.
const RA_RE = /^(RA RGW \d{2}-\d{3})\s+rev([A-Za-z0-9]+)\s*-\s*(.+?)\.pdf$/i;
const COSHH_RE = /^(COSHH \S+)\s+rev([A-Za-z0-9]+)\s*-\s*(.+?)\.pdf$/i;
const PROC_RE = /^(RGW F\d+(?: \d+\.\d+)?)\s*-\s*(.+?)\.pdf$/i;

function parseFilename(name) {
  let m = name.match(RA_RE);
  if (m) {
    return { doc_type: 'risk_assessment', ref_code: m[1].trim(), revision: m[2].trim(), title: m[3].trim() };
  }
  m = name.match(COSHH_RE);
  if (m) {
    return { doc_type: 'coshh', ref_code: m[1].trim(), revision: m[2].trim(), title: m[3].trim() };
  }
  m = name.match(PROC_RE);
  if (m) {
    return { doc_type: 'procedure', ref_code: m[1].trim(), revision: null, title: m[2].trim() };
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  // Source directory: prefer `--dir "<path>"`, fall back to a bare positional path.
  const dirIdx = args.indexOf('--dir');
  const folder = dirIdx !== -1 ? args[dirIdx + 1] : args.find((a) => !a.startsWith('--'));
  if (!folder) {
    console.error('Usage: node scripts/import-site-documents.mjs [--dry-run] --dir "<folder path>"');
    process.exit(1);
  }
  if (dryRun) console.log('*** DRY RUN — no uploads or inserts will be performed ***');

  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ---- Look up the site (by the exact target id, scoped to this company) ----
  const { data: site, error: siteError } = await admin
    .from('company_sites')
    .select('id, site_name')
    .eq('id', SITE_ID)
    .eq('company_id', COMPANY_ID)
    .single();

  if (siteError || !site) {
    console.error(`Could not find company_sites row ${SITE_ID} for this company:`, siteError?.message || 'none found');
    process.exit(1);
  }
  console.log(`Site found: "${site.site_name}" (id ${SITE_ID})`);

  // ---- Read the folder ----
  let entries;
  try {
    entries = readdirSync(folder);
  } catch (e) {
    console.error('Could not read folder:', folder, '-', e.message);
    process.exit(1);
  }
  const pdfFiles = entries.filter((f) => f.toLowerCase().endsWith('.pdf')).sort();
  console.log(`Found ${pdfFiles.length} PDF file(s) in folder.`);

  // ---- Parse filenames ----
  const parsed = [];
  let unparseable = 0;
  for (const name of pdfFiles) {
    const info = parseFilename(name);
    if (!info) {
      console.log(`SKIP (unparseable): ${name}`);
      unparseable++;
      continue;
    }
    parsed.push({ ...info, filename: name });
  }

  // ---- Parsed table ----
  console.log('\n----- Parsed files -----');
  for (const d of parsed) {
    console.log(
      [
        `file=${d.filename}`,
        `doc_type=${d.doc_type}`,
        `ref_code=${d.ref_code}`,
        `revision=${d.revision === null ? 'null' : d.revision}`,
        `title=${d.title}`,
      ].join('  |  ')
    );
  }
  const byType = parsed.reduce((acc, d) => { acc[d.doc_type] = (acc[d.doc_type] || 0) + 1; return acc; }, {});
  console.log(`\nParsed ${parsed.length} file(s): ${Object.entries(byType).map(([k, v]) => `${v} ${k}`).join(', ') || 'none'}; unparseable ${unparseable}.`);

  // ---- Duplicate guard: existing rows for this company ----
  const { data: existing, error: existingError } = await admin
    .from('site_documents')
    .select('ref_code')
    .eq('company_id', COMPANY_ID);

  if (existingError) {
    console.error('Could not fetch existing documents for duplicate check:', existingError.message);
    process.exit(1);
  }

  const seenRefs = new Set();
  for (const row of existing || []) {
    if (row.ref_code) seenRefs.add(row.ref_code.trim().toLowerCase());
  }

  // ---- Import loop ----
  let imported = 0;
  let skippedDuplicate = 0;
  let failed = 0;
  let index = 0;

  for (const doc of parsed) {
    const refKey = doc.ref_code.toLowerCase();

    if (seenRefs.has(refKey)) {
      console.log(`SKIP (duplicate ref_code): ${doc.ref_code} — ${doc.title}`);
      skippedDuplicate++;
      continue;
    }

    if (dryRun) {
      // Mark as seen so an in-folder duplicate ref_code is also reported as duplicate.
      seenRefs.add(refKey);
      imported++;
      console.log(`WOULD IMPORT: ${doc.ref_code} — ${doc.title}  [${doc.doc_type}, rev ${doc.revision === null ? 'null' : doc.revision}]`);
      continue;
    }

    let buffer;
    try {
      buffer = readFileSync(join(folder, doc.filename));
    } catch (e) {
      console.log(`FAIL (read error): ${doc.filename} - ${e.message}`);
      failed++;
      continue;
    }

    const filePath = `${COMPANY_ID}/${Date.now()}_${index}.pdf`;
    index++;

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(filePath, buffer, { contentType: 'application/pdf', upsert: false });

    if (uploadError) {
      console.log(`FAIL (upload): ${doc.ref_code} — ${doc.title} - ${uploadError.message}`);
      failed++;
      await sleep(100);
      continue;
    }

    const { error: insertError } = await admin.from('site_documents').insert({
      company_id: COMPANY_ID,
      site_id: SITE_ID,
      doc_type: doc.doc_type,
      title: doc.title,
      ref_code: doc.ref_code,
      revision: doc.revision,
      contractor_name: null,
      file_path: filePath,
      status: IMPORT_STATUS,
      review_date: REVIEW_DATE,
      uploaded_by: UPLOADED_BY,
    });

    if (insertError) {
      await admin.storage.from(BUCKET).remove([filePath]);
      console.log(`FAIL (insert, rolled back file): ${doc.ref_code} — ${doc.title} - ${insertError.message}`);
      failed++;
      await sleep(100);
      continue;
    }

    // Mark as seen so a duplicate ref_code within the same folder is also skipped.
    seenRefs.add(refKey);
    imported++;
    console.log(`${doc.ref_code} — ${doc.title}`);

    await sleep(100);
  }

  // ---- Summary ----
  console.log('\n----- Summary -----');
  console.log(`${dryRun ? 'would import' : 'imported'}: ${imported}`);
  console.log(`skipped as duplicate: ${skippedDuplicate}`);
  console.log(`unparseable: ${unparseable}`);
  console.log(`failed: ${failed}`);
}

main().catch((e) => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
