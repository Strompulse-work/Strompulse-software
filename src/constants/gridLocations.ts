export const DEVICE_LOCATIONS: Record<string, { name: string; type: string; lat: number; lng: number; roads: string[] }> = {
  "STROM001": { name: "Jericho Quarters", type: "estate", lat: 7.3970, lng: 3.8650, roads: ["Kudeti", "Onireke", "Jericho GRA"] },
  "STROM002": { name: "Agodi GRA", type: "estate", lat: 7.4080, lng: 3.9050, roads: ["Parliament", "Secretariat", "Ikolaba"] },
  "STROM003": { name: "Bodija Estate", type: "estate", lat: 7.4100, lng: 3.9000, roads: ["Awolowo Road", "Osuntokun", "Housing Corp"] },
  "STROM004": { name: "Challenge", type: "area", lat: 7.3600, lng: 3.8800, roads: ["Ring Rd", "Lagos Ibadan Exp", "Molete"] },
  "STROM005": { name: "Mokola", type: "area", lat: 7.3950, lng: 3.8850, roads: ["Sabo", "Queen Elizabeth Road", "Oremeji"] },
  "STROM006": { name: "Oluyole Estate", type: "estate", lat: 7.3500, lng: 3.8650, roads: ["Mobil", "Adeoyo", "Ring Road"] },
  "STROM007": { name: "Ring Road Area", type: "area", lat: 7.3650, lng: 3.8600, roads: ["State Hospital", "Liberty Stadium", "Oni and Sons"] },
  "STROM008": { name: "UI Campus", type: "school", lat: 7.4420, lng: 3.9000, roads: ["Bello", "Tafawa Balewa Way", "Agbowa"] },
  "STROM009": { name: "Mapo Hall", type: "area", lat: 7.3750, lng: 3.8950, roads: ["Bere", "Oja Oba Market", "Oje"] },
  "STROM010": { name: "Eleyele", type: "area", lat: 7.4050, lng: 3.8550, roads: ["Waterworks", "Jericho Rd", "Polytechnic Rd"] },
  "STROM011": { name: "MONATAN", type: "area", lat: 7.3880, lng: 3.8750, roads: ["New Ife Road", "Old Ife Road"] },
  "STROM012": { name: "OKETEDO", type: "area", lat: 7.3780, lng: 3.9100, roads: ["Oyo Road", "Agbowo Road"] },
};

export const CITIES = [
  { name: "Ibadan", available: true },
  { name: "Abuja", available: false },
  { name: "Port Harcourt", available: false },
  { name: "Abeokuta", available: false },
  { name: "Osogbo", available: false },
  { name: "Ilorin", available: false },
];