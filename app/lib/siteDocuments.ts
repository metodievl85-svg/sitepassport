import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

export function getAdminClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export type AuthResult = {
  user: { id: string; email?: string } | null;
  role: string | null;
  companyName: string | null;
  admin: SupabaseClient;
  errorStatus: number | null;
};

export async function getAuthedUser(req: NextRequest): Promise<AuthResult> {
  const admin = getAdminClient();
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return { user: null, role: null, companyName: null, admin, errorStatus: 401 };

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return { user: null, role: null, companyName: null, admin, errorStatus: 401 };

  const { data: profile } = await admin
    .from('profiles')
    .select('role, company_name')
    .eq('id', data.user.id)
    .single();

  return {
    user: { id: data.user.id, email: data.user.email ?? undefined },
    role: profile?.role ?? null,
    companyName: profile?.company_name ?? null,
    admin,
    errorStatus: null,
  };
}

export function extFromMime(mime: string): string {
  if (mime === 'application/pdf') return 'pdf';
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  return 'bin';
}
