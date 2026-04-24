import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { hostel_id, dry_run } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Get hostel config
    const { data: hostel } = await supabase
      .from("hostels")
      .select("name, upi_id, rent_due_date_day, whatsapp_reminders_enabled")
      .eq("id", hostel_id)
      .maybeSingle();

    if (!hostel) {
      return new Response(JSON.stringify({ error: "Hostel not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get unpaid/overdue tenants for current month
    const { data: unpaidPayments } = await supabase
      .from("rent_payments")
      .select("hosteller_id, amount, status")
      .eq("hostel_id", hostel_id)
      .eq("month", currentMonth)
      .eq("year", currentYear)
      .in("status", ["unpaid", "overdue"]);

    if (!unpaidPayments || unpaidPayments.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No unpaid tenants found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hostellerIds = unpaidPayments.map((p: Record<string, unknown>) => p.hosteller_id as string);

    const { data: hostellers } = await supabase
      .from("hostellers")
      .select("id, name, phone, room_id")
      .in("id", hostellerIds)
      .eq("status", "active");

    const { data: rooms } = await supabase
      .from("rooms")
      .select("id, room_number")
      .eq("hostel_id", hostel_id);

    const roomMap = new Map((rooms || []).map((r: Record<string, unknown>) => [r.id as string, r.room_number as string]));

    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const monthName = monthNames[currentMonth - 1];

    const results: { name: string; phone: string; whatsapp_url: string; message: string }[] = [];

    for (const hosteller of (hostellers || [])) {
      const payment = unpaidPayments.find((p: Record<string, unknown>) => p.hosteller_id === hosteller.id);
      const roomNum = roomMap.get(hosteller.room_id as string) || "—";
      const amount = (payment?.amount as number) || 0;

      const upiLink = hostel.upi_id
        ? `upi://pay?pa=${encodeURIComponent(hostel.upi_id)}&pn=${encodeURIComponent(hostel.name)}&am=${amount}&cu=INR&tn=Rent+${monthName}+${currentYear}`
        : "";

      const message = [
        `Hello ${hosteller.name},`,
        ``,
        `This is a reminder from *${hostel.name}*.`,
        ``,
        `Your rent for *${monthName} ${currentYear}* is due:`,
        `• Amount: *₹${amount.toLocaleString("en-IN")}*`,
        `• Room: *${roomNum}*`,
        `• Status: *${payment?.status || "Unpaid"}*`,
        upiLink ? `• Pay now: ${upiLink}` : `• Please pay at the earliest.`,
        ``,
        `If already paid, please ignore this message.`,
        `Thank you!`,
      ].join("\n");

      const cleanPhone = String(hosteller.phone).replace(/\D/g, "");
      const phoneWithCountry = cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`;
      const whatsappUrl = `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`;

      results.push({
        name: hosteller.name as string,
        phone: hosteller.phone as string,
        whatsapp_url: whatsappUrl,
        message,
      });

      if (!dry_run) {
        await supabase.from("notifications").insert({
          user_id: hosteller.id,
          user_role: "hosteller",
          type: "rent_reminder",
          message: `Rent reminder for ${monthName} ${currentYear}: ₹${amount} is due.`,
          reference_id: hostel_id,
        });
      }
    }

    return new Response(JSON.stringify({ sent: results.length, results, dry_run: !!dry_run }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
