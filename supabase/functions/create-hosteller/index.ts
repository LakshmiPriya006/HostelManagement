import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const {
      email, password, name, phone, aadhar_number, aadhar_url,
      room_id, hostel_id, owner_id, move_in_date,
      rent_paid, payment_mode, rent_amount,
    } = body;

    if (!email || !password || !name || !owner_id || !hostel_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields: email, password, name, owner_id, hostel_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let userId: string;

    // Try to find existing user by email using getUserByEmail is not available via admin
    // Instead, try creating — if they exist we'll get a specific error and can fetch them
    const { data: newUserData, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      if (createError.message?.toLowerCase().includes('already been registered') ||
          createError.message?.toLowerCase().includes('already registered') ||
          createError.message?.toLowerCase().includes('already exists') ||
          createError.message?.toLowerCase().includes('email address is already')) {
        // User exists — find them by listing and filtering
        const { data: listData, error: listError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
        if (listError) throw new Error(`Could not find existing user: ${listError.message}`);
        const existing = listData?.users?.find((u: any) => u.email === email);
        if (!existing) throw new Error('User with this email exists in auth but could not be retrieved');
        userId = existing.id;
        // DO NOT update their password here, as this could allow account takeover
      } else {
        throw createError;
      }
    } else {
      userId = newUserData.user.id;
    }

    // Upsert user role
    const { error: roleError } = await adminClient
      .from('user_roles')
      .upsert({ id: userId, role: 'hosteller' }, { onConflict: 'id' });
    if (roleError) throw new Error(`Role upsert failed: ${roleError.message}`);

    // Upsert hosteller record
    const { error: hostellerError } = await adminClient.from('hostellers').upsert({
      id: userId,
      owner_id,
      hostel_id,
      room_id: room_id || null,
      name,
      email,
      phone: phone || '',
      aadhar_number: aadhar_number || '',
      aadhar_url: aadhar_url || '',
      move_in_date: move_in_date || new Date().toISOString().split('T')[0],
      status: 'active',
      approval_status: 'approved',
    }, { onConflict: 'id' });
    if (hostellerError) throw new Error(`Hosteller record failed: ${hostellerError.message}`);

    // Update room status if room assigned
    if (room_id) {
      const { data: roomHostellers } = await adminClient
        .from('hostellers').select('id').eq('room_id', room_id).eq('status', 'active');
      const { data: roomData } = await adminClient.from('rooms').select('sharing_type').eq('id', room_id).maybeSingle();
      const count = roomHostellers?.length || 1;
      const max = roomData?.sharing_type === 'single' ? 1 : roomData?.sharing_type === 'double' ? 2 : 3;
      const newStatus = count >= max ? 'occupied' : 'partial';
      await adminClient.from('rooms').update({ status: newStatus }).eq('id', room_id);
    }

    // Create rent record if paid
    if (rent_paid && room_id && rent_amount != null) {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      const { data: existingRent } = await adminClient.from('rent_payments')
        .select('id').eq('hosteller_id', userId).eq('month', currentMonth).eq('year', currentYear).maybeSingle();
      if (!existingRent) {
        await adminClient.from('rent_payments').insert({
          hosteller_id: userId,
          hostel_id,
          room_id,
          month: currentMonth,
          year: currentYear,
          amount: rent_amount,
          fine_amount: 0,
          status: 'paid',
          payment_mode: payment_mode || 'cash',
          paid_at: now.toISOString(),
          marked_by_owner: true,
        });
      }
    }

    return new Response(JSON.stringify({ success: true, userId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('create-hosteller error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Unknown error occurred' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
