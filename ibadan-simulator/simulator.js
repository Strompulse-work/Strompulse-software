require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

async function simulateIbadanGrid() {
  console.log("⚡ Starting GLOBAL Ibadan Power Grid Simulator...");
  console.log("📡 Monitoring all neighborhoods...");

  // Run the simulation loop every 8 seconds for a fast-paced demo
  setInterval(async () => {
    // Fetch all devices in the city
    const { data: devices, error } = await supabase.from("devices").select("*");
    if (error || !devices || devices.length === 0) return;

    // Pick a random neighborhood from the list
    const randomDevice = devices[Math.floor(Math.random() * devices.length)];
    const newStatus = randomDevice.status === "ON" ? "OFF" : "ON";

    console.log(`[IBEDC UPDATE] ${randomDevice.address} is now ${newStatus}`);

    // Update the device status
    await supabase
      .from("devices")
      .update({
        status: newStatus,
        last_seen: new Date().toISOString(),
      })
      .eq("id", randomDevice.id);

    // Handle outage history for the Insights charts
    if (newStatus === "OFF") {
      await supabase.from("outages").insert({
        device_id: randomDevice.device_id,
        started_at: new Date().toISOString(),
        is_active: true,
      });
    } else {
      const { data: activeOutages } = await supabase
        .from("outages")
        .select("*")
        .eq("device_id", randomDevice.device_id)
        .eq("is_active", true);

      if (activeOutages && activeOutages.length > 0) {
        const outage = activeOutages[0];
        const endedAt = new Date();
        const startedAt = new Date(outage.started_at);
        // Multiply by 60 to fake longer outages for the charts
        const durationMins =
          Math.max(1, Math.round((endedAt - startedAt) / 1000)) * 60;

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
  }, 8000); // 8 seconds
}

simulateIbadanGrid();
