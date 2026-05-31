-- Run this in the Supabase SQL editor to add performance indexes for the company dashboard.

create index if not exists idx_site_attendance_company_created
  on site_attendance (company_id, created_at desc);

create index if not exists idx_saved_workers_company
  on saved_workers (company_id);

create index if not exists idx_induction_requests_company
  on induction_requests (company_id);

create index if not exists idx_site_attendance_worker
  on site_attendance (worker_id);
