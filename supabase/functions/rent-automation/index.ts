import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const cronSecret = Deno.env.get('CRON_SECRET');
    const authHeader = req.headers.get('Authorization');
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();

    const { data: hostels, error: hostelsError } = await supabase
      .from('hostels')
      .select('id, name, rent_due_date_day, late_fee_amount');

    if (hostelsError) throw hostelsError;

    let overdueMarked = 0;
    let remindersSent = 0;
    const results: string[] = [];

    for (const hostel of (hostels || [])) {
      const dueDay = hostel.rent_due_date_day || 5;
      const lateFee = hostel.late_fee_amount || 0;

      const { data: activeHostellers } = await supabase
        .from('hostellers')
        .select('id')
        .eq('hostel_id', hostel.id)
        .eq('status', 'active');

      if (!activeHostellers || activeHostellers.length === 0) continue;

      const hostellerIds = activeHostellers.map((h: any) => h.id);

      const { data: rentRecords } = await supabase
        .from('rent_payments')
        .select('*')
        .eq('hostel_id', hostel.id)
        .eq('month', currentMonth)
        .eq('year', currentYear)
        .in('hosteller_id', hostellerIds);

      const existingRentMap = new Map((rentRecords || []).map((r: any) => [r.hosteller_id, r]));

      if (currentDay === dueDay) {
        const unpaidHostellers = hostellerIds.filter(id => {
          const rent = existingRentMap.get(id);
          return !rent || rent.status === 'unpaid';
        });

        if (unpaidHostellers.length > 0) {
          await supabase.from('rent_payments')
            .update({ status: 'overdue', fine_amount: lateFee })
            .eq('hostel_id', hostel.id)
            .eq('month', currentMonth)
            .eq('year', currentYear)
            .in('hosteller_id', unpaidHostellers)
            .eq('status', 'unpaid');

          overdueMarked += unpaidHostellers.length;

          const notifications = unpaidHostellers.map(id => ({
            user_id: id,
            user_role: 'hosteller',
            type: 'rent_reminder',
            message: `Your rent for ${hostel.name} is now overdue. A late fee of ₹${lateFee} has been applied.`,
          }));
          await supabase.from('notifications').insert(notifications);
          remindersSent += unpaidHostellers.length;
        }
        results.push(`${hostel.name}: marked ${unpaidHostellers?.length || 0} overdue`);
      }

      if (currentDay === dueDay - 3 || currentDay === dueDay - 1) {
        const daysLeft = dueDay - currentDay;
        const unpaidHostellers = hostellerIds.filter(id => {
          const rent = existingRentMap.get(id);
          return !rent || rent.status === 'unpaid';
        });

        if (unpaidHostellers.length > 0) {
          const notifications = unpaidHostellers.map(id => ({
            user_id: id,
            user_role: 'hosteller',
            type: 'rent_reminder',
            message: `Reminder: Your rent for ${hostel.name} is due in ${daysLeft} day${daysLeft > 1 ? 's' : ''}. Please pay on time to avoid late fees.`,
          }));
          await supabase.from('notifications').insert(notifications);
          remindersSent += unpaidHostellers.length;
        }
        results.push(`${hostel.name}: sent ${unpaidHostellers?.length || 0} reminders (${daysLeft}d before due)`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${hostels?.length || 0} hostels. Overdue marked: ${overdueMarked}. Reminders sent: ${remindersSent}.`,
        details: results,
        date: today.toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
