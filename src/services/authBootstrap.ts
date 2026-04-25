import { supabase } from './supabase';

interface OwnerBootstrapInput {
  userId: string;
  email: string;
  name?: string | null;
  phone?: string | null;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim();
}

export async function ensureOwnerAuthRecords(input: OwnerBootstrapInput): Promise<void> {
  const { userId, email, name, phone } = input;

  const { error: roleError } = await supabase
    .from('user_roles')
    .upsert({ id: userId, role: 'owner' }, { onConflict: 'id', ignoreDuplicates: true });

  if (roleError) {
    throw new Error(`Failed to create owner role: ${roleError.message}`);
  }

  const { error: ownerError } = await supabase
    .from('owners')
    .upsert(
      {
        id: userId,
        email: normalizeText(email),
        name: normalizeText(name),
        phone: normalizeText(phone),
      },
      { onConflict: 'id' }
    );

  if (ownerError) {
    throw new Error(`Failed to create owner profile: ${ownerError.message}`);
  }
}

export async function ensureHostellerRoleRecord(userId: string): Promise<void> {
  const { error } = await supabase
    .from('user_roles')
    .upsert({ id: userId, role: 'hosteller' }, { onConflict: 'id', ignoreDuplicates: true });

  if (error) {
    throw new Error(`Failed to create hosteller role: ${error.message}`);
  }
}
