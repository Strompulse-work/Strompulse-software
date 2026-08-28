import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";

admin.initializeApp();

// Timeout threshold: 20 minutes in milliseconds
const VALIDITY_TIMEOUT_MS = 20 * 60 * 1000; 

// Helper function to convert "31072026161724" (DDMMYYYYHHMMSS) to Unix timestamp
function parseCustomTimestamp(timestampString: string): number | null {
    if (!timestampString || timestampString.length !== 14) return null;
    
    const day = parseInt(timestampString.substring(0, 2), 10);
    const month = parseInt(timestampString.substring(2, 4), 10) - 1; // Months are 0-indexed in JS
    const year = parseInt(timestampString.substring(4, 8), 10);
    const hours = parseInt(timestampString.substring(8, 10), 10);
    const minutes = parseInt(timestampString.substring(10, 12), 10);
    const seconds = parseInt(timestampString.substring(12, 14), 10);
    
    // Note: Assuming the hardware sends time in WAT (UTC+1)
    return new Date(year, month, day, hours, minutes, seconds).getTime();
}

export const calculateCityAvailability = onSchedule("every 15 minutes", async (event) => {
    const db = admin.database();
    const now = Date.now();
    
    try {
        const snapshot = await db.ref('PowerMonitor').once('value');
        const devices = snapshot.val();
        
        if (!devices) {
            console.log("No devices found.");
            return;
        }

        let validCount = 0;
        let onCount = 0;
        let outageCount = 0;

        for (const deviceData of Object.values<any>(devices)) {
            const realtime = deviceData.realtime;
            
            if (realtime && realtime.timestamp) {
                // Parse the custom "31072026161724" string
                const deviceTimeMs = parseCustomTimestamp(realtime.timestamp);
                
                if (deviceTimeMs) {
                    const timeSinceLastPing = now - deviceTimeMs;
                    
                    // Check if the device is VALID (pinged within 20 mins)
                    if (timeSinceLastPing <= VALIDITY_TIMEOUT_MS) {
                        validCount++;
                        
                        // Status 1 = ON, Status 0 = OUTAGE
                        if (realtime.status === 1) {
                            onCount++;
                        } else {
                            outageCount++;
                        }
                    }
                }
            }
        }

        // Calculate Availability Percentage
        let availabilityPercent = 0;
        if (validCount > 0) {
            availabilityPercent = (onCount / validCount) * 100;
        }

        // Format Date and Time for DB Storage (YYYY-MM-DD and HH:MM)
        const dateObj = new Date(now);
        // Ensure we are saving based on WAT (UTC+1)
        dateObj.setHours(dateObj.getHours() + 1); 
        
        const dateString = dateObj.toISOString().split('T')[0]; 
        const hours = String(dateObj.getUTCHours()).padStart(2, '0');
        const minutes = String(dateObj.getUTCMinutes()).padStart(2, '0');
        
        // Round to nearest 15-minute interval (00, 15, 30, 45) for clean plotting
        const roundedMinutes = String(Math.floor(parseInt(minutes) / 15) * 15).padStart(2, '0');
        const timeString = `${hours}:${roundedMinutes}`;

        // Save snapshot to CityAnalytics/Ibadan/YYYY-MM-DD/HH:MM
        const analyticsRef = db.ref(`CityAnalytics/Ibadan/${dateString}/${timeString}`);
        await analyticsRef.set({
            timestamp: now,
            valid_devices: validCount,
            on_count: onCount,
            outage_count: outageCount,
            availability_percent: Math.round(availabilityPercent) 
        });

        console.log(`Snapshot saved for ${timeString}: ${Math.round(availabilityPercent)}% Availability`);

    } catch (error) {
        console.error("Error calculating city availability:", error);
    }
});