require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

async function simulateIbadanGrid() {
  console.log("⚡ Starting Ibadan Power Grid Simulator...");
  console.log("📡 Listening for devices...");

  setInterval(async () => {
    const { data: devices, error } = await supabase
      .from("devices")
      .select("*")
      .limit(1);

    if (error || !devices || devices.length === 0) return;

    const device = devices[0];
    const newStatus = device.status === "ON" ? "OFF" : "ON";

    console.log(`[IBEDC UPDATE] ${device.address} is now ${newStatus}`);

    await supabase
      .from("devices")
      .update({
        status: newStatus,
        last_seen: new Date().toISOString(),
      })
      .eq("id", device.id);

    if (newStatus === "OFF") {
      await supabase.from("outages").insert({
        device_id: device.device_id,
        started_at: new Date().toISOString(),
        is_active: true,
      });
    } else {
      const { data: activeOutages } = await supabase
        .from("outages")
        .select("*")
        .eq("device_id", device.device_id)
        .eq("is_active", true);

      if (activeOutages && activeOutages.length > 0) {
        const outage = activeOutages[0];
        const endedAt = new Date();
        const startedAt = new Date(outage.started_at);
        const durationMins = Math.max(
          1,
          Math.round((endedAt - startedAt) / 1000),
        );

        await supabase
          .from("outages")
          .update({
            ended_at: endedAt.toISOString(),
            duration_minutes: durationMins,
            is_active: false,
          })
          .eq("id", outage.id);
      }
    }
  }, 30000); // Toggles every 30 seconds
}

simulateIbadanGrid();
