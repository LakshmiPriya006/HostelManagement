import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface QueryResult {
  answer: string;
  data?: Record<string, unknown>[];
  type: "text" | "table" | "stats";
  actions?: { label: string; action: string }[];
}

function detectIntent(q: string): string {
  const lower = q.toLowerCase();
  if (/unpaid|due|not paid|pending rent|rent due/.test(lower)) return "unpaid_rent";
  if (/vacant|empty|available room/.test(lower)) return "vacant_rooms";
  if (/revenue|income|collected|total rent/.test(lower)) return "revenue";
  if (/occupied|full room/.test(lower)) return "occupied_rooms";
  if (/hostel(ler)?s?|tenant|resident|total.*people|how many.*people/.test(lower)) return "total_hostellers";
  if (/problem|issue|complaint|maintenance/.test(lower)) return "problems";
  if (/overdue|late/.test(lower)) return "overdue_rent";
  if (/room.*type|ac|non.ac/.test(lower)) return "room_types";
  if (/announce/.test(lower)) return "announcements";
  return "general";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { query, hostel_id } = await req.json();

    if (!query || !hostel_id) {
      return new Response(JSON.stringify({ error: "query and hostel_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const intent = detectIntent(query);
    let result: QueryResult;

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    switch (intent) {
      case "unpaid_rent": {
        const { data: payments } = await supabase
          .from("rent_payments")
          .select("hosteller_id, amount, status")
          .eq("hostel_id", hostel_id)
          .eq("month", currentMonth)
          .eq("year", currentYear)
          .in("status", ["unpaid", "overdue"]);

        const hostellerIds = (payments || []).map((p: Record<string, unknown>) => p.hosteller_id as string);
        let hostellers: Record<string, unknown>[] = [];
        if (hostellerIds.length > 0) {
          const { data } = await supabase
            .from("hostellers")
            .select("id, name, phone, room_id")
            .in("id", hostellerIds)
            .eq("status", "active");
          hostellers = data || [];
        }

        const { data: rooms } = await supabase
          .from("rooms")
          .select("id, room_number")
          .eq("hostel_id", hostel_id);

        const roomMap = new Map((rooms || []).map((r: Record<string, unknown>) => [r.id as string, r.room_number as string]));

        const tableData = hostellers.map((h) => {
          const payment = (payments || []).find((p: Record<string, unknown>) => p.hosteller_id === h.id);
          return {
            Name: h.name,
            Room: roomMap.get(h.room_id as string) || "—",
            Amount: `₹${(payment?.amount as number) || 0}`,
            Status: (payment?.status as string) || "unpaid",
          };
        });

        const totalDue = (payments || []).reduce((sum: number, p: Record<string, unknown>) => sum + ((p.amount as number) || 0), 0);

        result = {
          type: "table",
          answer: `${hostellers.length} tenant${hostellers.length !== 1 ? "s have" : " has"} not paid rent this month. Total pending: ₹${totalDue.toLocaleString("en-IN")}.`,
          data: tableData,
          actions: hostellers.length > 0 ? [{ label: "Send reminders to all", action: "send_reminders" }] : undefined,
        };
        break;
      }

      case "vacant_rooms": {
        const { data: rooms } = await supabase
          .from("rooms")
          .select("room_number, room_type, sharing_type, rent_amount")
          .eq("hostel_id", hostel_id)
          .eq("status", "available");

        result = {
          type: "table",
          answer: `${(rooms || []).length} vacant room${(rooms || []).length !== 1 ? "s" : ""} available right now.`,
          data: (rooms || []).map((r: Record<string, unknown>) => ({
            Room: r.room_number,
            Type: (r.room_type as string).toUpperCase(),
            Sharing: r.sharing_type,
            Rent: `₹${r.rent_amount}/mo`,
          })),
        };
        break;
      }

      case "revenue": {
        const { data: payments } = await supabase
          .from("rent_payments")
          .select("amount, status, month, year")
          .eq("hostel_id", hostel_id)
          .eq("status", "paid")
          .eq("month", currentMonth)
          .eq("year", currentYear);

        const total = (payments || []).reduce((sum: number, p: Record<string, unknown>) => sum + ((p.amount as number) || 0), 0);

        const { data: allPayments } = await supabase
          .from("rent_payments")
          .select("amount, status")
          .eq("hostel_id", hostel_id)
          .eq("month", currentMonth)
          .eq("year", currentYear);

        const totalExpected = (allPayments || []).reduce((sum: number, p: Record<string, unknown>) => sum + ((p.amount as number) || 0), 0);
        const pct = totalExpected > 0 ? Math.round((total / totalExpected) * 100) : 0;

        result = {
          type: "stats",
          answer: `Total rent collected this month: ₹${total.toLocaleString("en-IN")} (${pct}% of expected ₹${totalExpected.toLocaleString("en-IN")}).`,
          data: [{ Collected: `₹${total.toLocaleString("en-IN")}`, Expected: `₹${totalExpected.toLocaleString("en-IN")}`, "Collection Rate": `${pct}%` }],
        };
        break;
      }

      case "total_hostellers": {
        const { count } = await supabase
          .from("hostellers")
          .select("*", { count: "exact", head: true })
          .eq("hostel_id", hostel_id)
          .eq("status", "active");

        result = {
          type: "stats",
          answer: `There are currently ${count || 0} active residents in this hostel.`,
          data: [{ "Active Residents": count || 0 }],
        };
        break;
      }

      case "occupied_rooms": {
        const { data: rooms } = await supabase
          .from("rooms")
          .select("room_number, room_type, sharing_type, status")
          .eq("hostel_id", hostel_id)
          .eq("status", "occupied");

        result = {
          type: "table",
          answer: `${(rooms || []).length} room${(rooms || []).length !== 1 ? "s are" : " is"} fully occupied.`,
          data: (rooms || []).map((r: Record<string, unknown>) => ({
            Room: r.room_number,
            Type: (r.room_type as string).toUpperCase(),
            Sharing: r.sharing_type,
          })),
        };
        break;
      }

      case "problems": {
        const { data: problems } = await supabase
          .from("problems")
          .select("title, status, created_at, hosteller_id")
          .eq("hostel_id", hostel_id)
          .in("status", ["open", "in_progress"])
          .order("created_at", { ascending: false });

        const hostellerIds = [...new Set((problems || []).map((p: Record<string, unknown>) => p.hosteller_id as string))];
        let hostellers: Record<string, unknown>[] = [];
        if (hostellerIds.length > 0) {
          const { data } = await supabase.from("hostellers").select("id, name").in("id", hostellerIds);
          hostellers = data || [];
        }

        const nameMap = new Map(hostellers.map((h) => [h.id as string, h.name as string]));

        result = {
          type: "table",
          answer: `${(problems || []).length} unresolved problem${(problems || []).length !== 1 ? "s" : ""} reported.`,
          data: (problems || []).map((p: Record<string, unknown>) => ({
            Title: p.title,
            Status: p.status,
            Reported_By: nameMap.get(p.hosteller_id as string) || "Unknown",
          })),
        };
        break;
      }

      case "overdue_rent": {
        const { data: payments } = await supabase
          .from("rent_payments")
          .select("hosteller_id, amount, month, year")
          .eq("hostel_id", hostel_id)
          .eq("status", "overdue");

        const hostellerIds = (payments || []).map((p: Record<string, unknown>) => p.hosteller_id as string);
        let hostellers: Record<string, unknown>[] = [];
        if (hostellerIds.length > 0) {
          const { data } = await supabase.from("hostellers").select("id, name, phone").in("id", hostellerIds).eq("status", "active");
          hostellers = data || [];
        }

        result = {
          type: "table",
          answer: `${hostellers.length} tenant${hostellers.length !== 1 ? "s have" : " has"} overdue rent.`,
          data: hostellers.map((h) => {
            const payment = (payments || []).find((p: Record<string, unknown>) => p.hosteller_id === h.id);
            return { Name: h.name, Phone: h.phone, Amount: `₹${(payment?.amount as number) || 0}`, Month: `${payment?.month}/${payment?.year}` };
          }),
          actions: hostellers.length > 0 ? [{ label: "Send reminders to overdue", action: "send_reminders_overdue" }] : undefined,
        };
        break;
      }

      case "room_types": {
        const { data: rooms } = await supabase
          .from("rooms")
          .select("room_type, status")
          .eq("hostel_id", hostel_id);

        const ac = (rooms || []).filter((r: Record<string, unknown>) => r.room_type === "ac");
        const nonAc = (rooms || []).filter((r: Record<string, unknown>) => r.room_type !== "ac");

        result = {
          type: "stats",
          answer: `Hostel has ${ac.length} AC rooms (${ac.filter((r: Record<string, unknown>) => r.status === "available").length} vacant) and ${nonAc.length} Non-AC rooms (${nonAc.filter((r: Record<string, unknown>) => r.status === "available").length} vacant).`,
          data: [
            { Type: "AC", Total: ac.length, Vacant: ac.filter((r: Record<string, unknown>) => r.status === "available").length },
            { Type: "Non-AC", Total: nonAc.length, Vacant: nonAc.filter((r: Record<string, unknown>) => r.status === "available").length },
          ],
        };
        break;
      }

      default: {
        const { count: hostCount } = await supabase
          .from("hostellers")
          .select("*", { count: "exact", head: true })
          .eq("hostel_id", hostel_id)
          .eq("status", "active");

        const { data: roomSummary } = await supabase
          .from("rooms")
          .select("status")
          .eq("hostel_id", hostel_id);

        const vacant = (roomSummary || []).filter((r: Record<string, unknown>) => r.status === "available").length;
        const occupied = (roomSummary || []).filter((r: Record<string, unknown>) => r.status === "occupied").length;

        result = {
          type: "text",
          answer: `Here's a quick summary: ${hostCount || 0} active residents, ${occupied} fully occupied rooms, ${vacant} vacant rooms. Try asking: "How many unpaid tenants?", "Which rooms are vacant?", or "Total revenue this month?"`,
        };
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
