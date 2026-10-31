// src/utils/routing.ts
// Driving route + ETA using Google's Routes API (works with your iOS/Android-restricted keys).
// If Google can't return a route, falls back to an estimate from straight-line distance so the user always gets an ETA.
import { Platform } from "react-native";

const GOOGLE_API_KEY = Platform.OS === "ios" ? "AIzaSyCeWigeIvMAGJ_X-qj8UqY6CoGTbzBSHfA" : "AIzaSyB76SNOlgP1dkPZXhlPPIU_650y45Cd1Mo";
const FALLBACK_SPEED_KMH = 25;   // typical Nigerian city driving speed incl. traffic
const ROAD_FACTOR = 1.35;        // roads are ~35% longer than a straight line

export type LatLng = { lat: number; lng: number };
export type RouteResult = {
  points: { latitude: number; longitude: number }[];
  durationSec: number;
  distanceKm: number;
  durationText: string;
  distanceText: string;
  steps: { text: string; distance: string }[];
  isEstimate: boolean; // true when Google had no route and we estimated
};

export const decodePolyline = (encoded: string) => {
  const points: { latitude: number; longitude: number }[] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
};

export const kmBetween = (a: LatLng, b: LatLng) => {
  const R = 6371;
  const dLat = (b.lat - a.lat) * (Math.PI / 180);
  const dLon = (b.lng - a.lng) * (Math.PI / 180);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * (Math.PI / 180)) * Math.cos(b.lat * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

export const formatDuration = (sec: number) => {
  const mins = Math.max(1, Math.round(sec / 60));
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"}`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
};

export const formatDistance = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);

const estimateRoute = (origin: LatLng, dest: LatLng): RouteResult => {
  const distanceKm = kmBetween(origin, dest) * ROAD_FACTOR;
  const durationSec = Math.max(60, (distanceKm / FALLBACK_SPEED_KMH) * 3600);
  return {
    points: [{ latitude: origin.lat, longitude: origin.lng }, { latitude: dest.lat, longitude: dest.lng }],
    durationSec,
    distanceKm,
    durationText: `~${formatDuration(durationSec)}`,
    distanceText: `~${formatDistance(distanceKm)}`,
    steps: [],
    isEstimate: true,
  };
};

export const getDrivingRoute = async (origin: LatLng, dest: LatLng, withSteps = false): Promise<RouteResult> => {
  try {
    const headers: any = {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_API_KEY,
      "X-Goog-FieldMask": `routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline${withSteps ? ",routes.legs.steps.navigationInstruction,routes.legs.steps.distanceMeters" : ""}`,
    };
    if (Platform.OS === "ios") headers["X-Ios-Bundle-Identifier"] = "com.strompulse.app";
    if (Platform.OS === "android") headers["X-Android-Package"] = "com.strompulse.app";

    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers,
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
        destination: { location: { latLng: { latitude: dest.lat, longitude: dest.lng } } },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
      }),
    });
    const data = await res.json();
    if (data.error) console.warn("[Routes API]", data.error.status, data.error.message);

    const r = data.routes?.[0];
    if (!r || !r.duration) return estimateRoute(origin, dest);

    const durationSec = parseInt(String(r.duration).replace("s", ""), 10) || 0;
    const distanceKm = (r.distanceMeters || 0) / 1000;
    const steps = withSteps
      ? (r.legs?.[0]?.steps || [])
          .filter((s: any) => s.navigationInstruction?.instructions)
          .map((s: any) => ({ text: s.navigationInstruction.instructions, distance: formatDistance((s.distanceMeters || 0) / 1000) }))
      : [];

    return {
      points: r.polyline?.encodedPolyline ? decodePolyline(r.polyline.encodedPolyline) : [],
      durationSec,
      distanceKm,
      durationText: formatDuration(durationSec),
      distanceText: formatDistance(distanceKm),
      steps,
      isEstimate: false,
    };
  } catch (e) {
    console.warn("[Routes API] request failed", e);
    return estimateRoute(origin, dest);
  }
};