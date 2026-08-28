import React from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  Platform, 
  StatusBar, 
  TouchableOpacity,
  ScrollView
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Svg, { Path, Defs, LinearGradient as SvgGradient, Stop, Circle as SvgCircle } from "react-native-svg";
import { useTheme } from "../theme/ThemeContext";

// Reusable Donut Chart Component
const DonutChartText = ({ percentage, value, label, color, isDarkMode }: any) => {
  const radius = 35;
  const strokeWidth = 12;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <View style={styles.donutCard}>
      <Text style={styles.donutHeader}>{label}</Text>
      <View style={styles.donutWrapper}>
        <Svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: [{ rotate: "-90deg" }] }}>
          {/* Background Circle */}
          <SvgCircle cx="50" cy="50" r={radius} stroke={isDarkMode ? "#2D3B34" : "#F1F5F9"} strokeWidth={strokeWidth} fill="transparent" />
          {/* Progress Circle */}
          <SvgCircle 
            cx="50" cy="50" r={radius} 
            stroke={color} 
            strokeWidth={strokeWidth} 
            fill="transparent" 
            strokeDasharray={circumference} 
            strokeDashoffset={strokeDashoffset} 
            strokeLinecap="round" 
          />
        </Svg>
        <View style={styles.donutCenter}>
          <Text style={[styles.donutPercentage, { color: isDarkMode ? "#FFFFFF" : "#1E293B" }]}>{percentage}%</Text>
        </View>
      </View>
      <Text style={[styles.donutValue, { color: isDarkMode ? "#FFFFFF" : "#1E293B" }]}>{value}</Text>
    </View>
  );
};

const PrivateDashboardInternalScreen = ({ navigation }: any) => {
  const { isDarkMode } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? "#0B0F0D" : "#F8FAFC" }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor="transparent" translucent={false} />
      
      {/* Custom Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerSubtitle, { color: isDarkMode ? "#94A3B8" : "#64748B" }]}>Pole Sentinel 001</Text>
          <Text style={[styles.headerTitle, { color: isDarkMode ? "#FFFFFF" : "#1E293B" }]}>My Dashboard</Text>
        </View>
        <TouchableOpacity 
          style={[styles.lockBtn, { backgroundColor: isDarkMode ? "rgba(239,68,68,0.15)" : "#FEE2E2" }]} 
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons name="lock" size={16} color="#EF4444" />
          <Text style={styles.lockBtnText}>Lock Vault</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Main Hardware Status Card */}
        <View style={[styles.statusCard, { backgroundColor: isDarkMode ? "#121A16" : "#FFFFFF", borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0" }]}>
          <View style={styles.statusRow}>
            <View style={styles.statusLeft}>
              <View style={styles.liveDot} />
              <Text style={styles.statusText}>Presently Stable</Text>
            </View>
            <Text style={[styles.timestamp, { color: isDarkMode ? "#64748B" : "#94A3B8" }]}>Updated just now</Text>
          </View>
          <Text style={[styles.voltageText, { color: isDarkMode ? "#FFFFFF" : "#1E293B" }]}>224<Text style={styles.voltageUnit}> V</Text></Text>
          <Text style={[styles.voltageLabel, { color: isDarkMode ? "#94A3B8" : "#64748B" }]}>Real-time Current Phase</Text>
        </View>

        {/* Power Status Curve Card */}
        <View style={[styles.curveCard, { backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF", borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0" }]}>
          <View style={styles.curveHeader}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={[styles.curveIconBox, { backgroundColor: isDarkMode ? "rgba(0,196,138,0.1)" : "#ECFDF5" }]}>
                <MaterialCommunityIcons name="chart-line" size={18} color="#00C48A" />
              </View>
              <View style={{ marginLeft: 12 }}>
                <Text style={[styles.curveTitle, { color: isDarkMode ? "#FFFFFF" : "#1E293B" }]}>Power Status Curve</Text>
                <Text style={styles.curveSub}>Today's pattern · Home Device</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.curveBtn}>
              <Text style={styles.curveBtnText}>Today ▾</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.svgWrapper}>
            <Svg width="100%" height="160" viewBox="0 0 320 160">
              <Defs>
                <SvgGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#00C48A" stopOpacity="0.3" />
                  <Stop offset="1" stopColor="#00C48A" stopOpacity="0" />
                </SvgGradient>
                <SvgGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor="#00C48A" />
                  <Stop offset="0.6" stopColor="#3B82F6" />
                  <Stop offset="1" stopColor="#8B5CF6" />
                </SvgGradient>
              </Defs>

              {/* Grid Lines */}
              <Path d="M 40 10 L 40 130" stroke={isDarkMode ? "#2D3B34" : "#F1F5F9"} strokeWidth="1" strokeDasharray="4 4" />
              <Path d="M 120 10 L 120 130" stroke={isDarkMode ? "#2D3B34" : "#F1F5F9"} strokeWidth="1" strokeDasharray="4 4" />
              <Path d="M 200 10 L 200 130" stroke={isDarkMode ? "#2D3B34" : "#F1F5F9"} strokeWidth="1" strokeDasharray="4 4" />
              <Path d="M 280 10 L 280 130" stroke={isDarkMode ? "#2D3B34" : "#F1F5F9"} strokeWidth="1" strokeDasharray="4 4" />
              <Path d="M 0 130 L 320 130" stroke={isDarkMode ? "#2D3B34" : "#E2E8F0"} strokeWidth="1" />

              {/* Curved Line and Fill */}
              <Path d="M 0 100 C 40 60, 80 50, 140 30 C 200 10, 240 120, 320 70 L 320 130 L 0 130 Z" fill="url(#fillGrad)" />
              <Path d="M 0 100 C 40 60, 80 50, 140 30 C 200 10, 240 120, 320 70" fill="none" stroke="url(#lineGrad)" strokeWidth="4" strokeLinecap="round" />
              
              {/* Data Points */}
              <SvgCircle cx="60" cy="72" r="5" fill={isDarkMode ? "#1A221E" : "#FFF"} stroke="#00C48A" strokeWidth="3" />
              <SvgCircle cx="160" cy="38" r="5" fill={isDarkMode ? "#1A221E" : "#FFF"} stroke="#3B82F6" strokeWidth="3" />
              <SvgCircle cx="240" cy="100" r="5" fill={isDarkMode ? "#1A221E" : "#FFF"} stroke="#8B5CF6" strokeWidth="3" />
            </Svg>

            <View style={styles.chartXAxis}>
              <Text style={styles.chartXText}>12am</Text>
              <Text style={styles.chartXText}>6am</Text>
              <Text style={styles.chartXText}>12pm</Text>
              <Text style={styles.chartXText}>6pm</Text>
              <Text style={styles.chartXText}>11pm</Text>
            </View>
          </View>
        </View>

        {/* Donuts Row */}
        <View style={styles.donutsRow}>
          <View style={[styles.donutContainer, { backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF", borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0" }]}>
             <DonutChartText percentage={82} value="19.7 hrs" label="TODAY'S UPTIME" color="#00C48A" isDarkMode={isDarkMode} />
             <Text style={styles.donutSubtext}>of 24 hours today</Text>
          </View>
          <View style={[styles.donutContainer, { backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF", borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0" }]}>
             <DonutChartText percentage={76} value="4.2 outages" label="7-DAY STABILITY" color="#3B82F6" isDarkMode={isDarkMode} />
             <Text style={styles.donutSubtext}>avg. this week</Text>
          </View>
        </View>

        {/* Weekly Bar Chart */}
        <View style={[styles.barChartCard, { backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF", borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0" }]}>
          <View style={styles.curveHeader}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={[styles.curveIconBox, { backgroundColor: isDarkMode ? "rgba(0,196,138,0.1)" : "#ECFDF5" }]}>
                <MaterialCommunityIcons name="chart-bar" size={18} color="#00C48A" />
              </View>
              <View style={{ marginLeft: 12 }}>
                <Text style={[styles.curveTitle, { color: isDarkMode ? "#FFFFFF" : "#1E293B" }]}>This Week's Power Flow</Text>
                <Text style={styles.curveSub}>Daily uptime hours · Home Device</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.curveBtn}>
              <Text style={styles.curveBtnText}>This week ▾</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.barsRow}>
            {[14, 18, 22, 10, 16, 20, 19].map((val, idx) => (
              <View key={idx} style={styles.barColumn}>
                <View style={[styles.barTrack, { backgroundColor: isDarkMode ? "#2D3B34" : "#F1F5F9" }]}>
                  <View style={[styles.barFill, { height: `${(val / 24) * 100}%` }]} />
                </View>
                <Text style={styles.barLabel}>{["M", "T", "W", "T", "F", "S", "S"][idx]}</Text>
              </View>
            ))}
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 20 : 10, paddingBottom: 20 },
  headerSubtitle: { fontSize: 11, fontFamily: "Sora_600SemiBold", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  headerTitle: { fontSize: 24, fontFamily: "Sora_800ExtraBold" },
  lockBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  lockBtnText: { color: "#EF4444", fontSize: 12, fontFamily: "Sora_700Bold", marginLeft: 6 },
  
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },
  
  // Status Banner
  statusCard: { padding: 24, borderRadius: 24, borderWidth: 1, marginBottom: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  statusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  statusLeft: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,196,138,0.15)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#00C48A", marginRight: 8 },
  statusText: { fontSize: 12, fontFamily: "Sora_700Bold", color: "#00C48A" },
  timestamp: { fontSize: 11, fontFamily: "Sora_500Medium" },
  voltageText: { fontSize: 48, fontFamily: "Sora_800ExtraBold" },
  voltageUnit: { fontSize: 24, fontFamily: "Sora_600SemiBold" },
  voltageLabel: { fontSize: 12, fontFamily: "Sora_500Medium", marginTop: 4 },

  // Curve Chart
  curveCard: { borderRadius: 24, borderWidth: 1, padding: 20, marginBottom: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  curveHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  curveIconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  curveTitle: { fontSize: 15, fontFamily: "Sora_700Bold", marginBottom: 2 },
  curveSub: { fontSize: 11, fontFamily: "Sora_500Medium", color: "#64748B" },
  curveBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: "#F1F5F9" },
  curveBtnText: { fontSize: 11, fontFamily: "Sora_600SemiBold", color: "#475569" },
  svgWrapper: { height: 160, width: "100%" },
  chartXAxis: { flexDirection: "row", justifyContent: "space-between", marginTop: 12, paddingHorizontal: 4 },
  chartXText: { fontSize: 10, fontFamily: "Sora_600SemiBold", color: "#94A3B8" },

  // Donuts
  donutsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  donutContainer: { flex: 1, borderRadius: 24, borderWidth: 1, padding: 20, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2, marginHorizontal: 4 },
  donutCard: { alignItems: "center" },
  donutHeader: { fontSize: 10, fontFamily: "Sora_700Bold", color: "#94A3B8", letterSpacing: 1, marginBottom: 16 },
  donutWrapper: { width: 100, height: 100, position: "relative", marginBottom: 16 },
  donutCenter: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center" },
  donutPercentage: { fontSize: 20, fontFamily: "Sora_800ExtraBold" },
  donutValue: { fontSize: 16, fontFamily: "Sora_700Bold", marginBottom: 4 },
  donutSubtext: { fontSize: 10, fontFamily: "Sora_500Medium", color: "#64748B" },

  // Bar Chart
  barChartCard: { borderRadius: 24, borderWidth: 1, padding: 20, marginBottom: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  barsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", height: 120, marginTop: 10 },
  barColumn: { alignItems: "center", width: 30 },
  barTrack: { width: 12, height: 90, borderRadius: 6, justifyContent: "flex-end", overflow: "hidden", marginBottom: 8 },
  barFill: { width: "100%", backgroundColor: "#00C48A", borderRadius: 6 },
  barLabel: { fontSize: 11, fontFamily: "Sora_600SemiBold", color: "#94A3B8" }
});

export default PrivateDashboardInternalScreen;