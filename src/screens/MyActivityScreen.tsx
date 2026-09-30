import React, { useState, useCallback, useEffect } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity, 
  ScrollView, 
  Platform, 
  ActivityIndicator 
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import { supabase } from "../config/supabase";
import AuthService from "../services/authService";
import { useFocusEffect } from "@react-navigation/native";

const getRelativeTime = (date: Date) => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "Just now";
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;
  
  const diffInWeeks = Math.floor(diffInDays / 7);
  return `${diffInWeeks}w ago`;
};

// Intercepts the raw event data and formats it as a first-person user action
const parseUserActivity = (item: any, isDarkMode: boolean) => {
  const type = item.type?.toLowerCase() || '';
  const rawTitle = item.title?.toLowerCase() || '';
  const rawMessage = item.message?.toLowerCase() || '';
  const createdAt = item.created_at ? new Date(item.created_at) : new Date();

  let icon = "clock-outline";
  let color = "#3B82F6";
  let bg = isDarkMode ? "rgba(59,130,246,0.1)" : "#EFF6FF";
  let title = "App Activity";
  let subtitle = "You performed an action in the Strompulse app.";

  // Transform into first-person actions based on the event type
  if (type.includes('sos') || type.includes('emergency') || rawTitle.includes('sos')) {
    icon = "shield-alert-outline";
    color = "#EF4444";
    bg = isDarkMode ? "rgba(239,68,68,0.1)" : "#FEE2E2";
    title = "SOS Alert Sent";
    subtitle = "You sent out an SOS alert to your emergency network.";
  } else if (type.includes('journey') || rawMessage.includes('journey')) {
    icon = "map-marker-path";
    color = "#00C48A";
    bg = isDarkMode ? "rgba(0,196,138,0.1)" : "#ECFDF5";
    title = "Journey Shared";
    subtitle = "You shared your live journey tracking route.";
  } else if (type.includes('report') || rawTitle.includes('report') || rawTitle.includes('power')) {
    icon = "flash-outline";
    color = "#F59E0B";
    bg = isDarkMode ? "rgba(245,158,11,0.1)" : "#FEF3C7";
    title = "Power Report Submitted";
    subtitle = "You submitted a real-time power report for a grid region.";
  } else if (type.includes('vote') || rawMessage.includes('voted')) {
    icon = "check-decagram-outline";
    color = "#8B5CF6";
    bg = isDarkMode ? "rgba(139,92,246,0.1)" : "#F3E8FF";
    title = "Accuracy Vote Cast";
    subtitle = "You verified the accuracy of a community power zone.";
  }

  return {
    id: item.id || Math.random().toString(),
    title,
    subtitle,
    time: getRelativeTime(createdAt),
    rawDate: createdAt,
    icon,
    color,
    bg
  };
};

const MyActivityScreen = ({ navigation }: any) => {
  const { theme, isDarkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      const fetchRecentActivities = async () => {
        setLoading(true);
        try {
          const session = await AuthService.getCurrentSession();
          const currentUserId = session?.user?.id;
          
          if (isMounted && currentUserId) {
            setUserId(currentUserId);
            
            // Limit query strictly to the last 10 days
            const tenDaysAgo = new Date();
            tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

            // Fetch only alerts/actions triggered specifically by this user
            const { data, error } = await supabase
              .from('alerts')
              .select('*')
              .eq('user_id', currentUserId)
              .gte('created_at', tenDaysAgo.toISOString())
              .order('created_at', { ascending: false });

            if (!error && data) {
              setActivities(data.map(item => parseUserActivity(item, isDarkMode)));
            }
          }
        } catch (err) {
          console.error("Error fetching activities:", err);
        } finally {
          if (isMounted) setLoading(false);
        }
      };

      fetchRecentActivities();

      return () => {
        isMounted = false;
      };
    }, [isDarkMode])
  );

  useEffect(() => {
    let isMounted = true;
    if (!userId) return;
    
    // Real-time Listener filtered strictly to the current user's inserts
    const activitySubscription = supabase
      .channel('public:user_activities')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'alerts',
        filter: `user_id=eq.${userId}` 
      }, payload => {
        if (isMounted) {
          const newActivity = parseUserActivity(payload.new, isDarkMode);
          // Instantly pop the new action to the top of the timeline
          setActivities(prev => [newActivity, ...prev]);
        }
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(activitySubscription);
    };
  }, [userId, isDarkMode]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDarkMode ? "#0B0F0D" : "#F4F6F8" }}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>My Activity</Text>
        <View style={styles.iconBtn} />
      </View>

      <View style={{ paddingHorizontal: 24, paddingBottom: 16 }}>
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>PAST 10 DAYS</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color="#00C48A" />
        </View>
      ) : activities.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 40 }}>
          <MaterialCommunityIcons name="clipboard-text-clock-outline" size={48} color={theme.textSecondary} style={{ opacity: 0.5, marginBottom: 16 }} />
          <Text style={{ fontFamily: "Chirp-Medium", fontSize: 14, color: theme.textSecondary, textAlign: "center" }}>
            You haven't recorded any activity in the past 10 days.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {activities.map((item) => (
            <View key={item.id} style={[styles.card, { backgroundColor: isDarkMode ? "#121A16" : "#FFFFFF", borderColor: isDarkMode ? "#2D3B34" : "#F1F5F9" }]}>
              <View style={[styles.iconBox, { backgroundColor: item.bg }]}>
                <MaterialCommunityIcons name={item.icon} size={20} color={item.color} />
              </View>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={[styles.title, { color: theme.textPrimary }]} numberOfLines={1}>{item.title}</Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={2}>{item.subtitle}</Text>
              </View>
              <Text style={[styles.time, { color: theme.textSecondary }]}>{item.time}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  header: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center", 
    paddingHorizontal: 20, 
    paddingTop: Platform.OS === 'android' ? 20 : 10, 
    paddingBottom: 16 
  },
  iconBtn: { 
    width: 40, 
    height: 40, 
    justifyContent: "center", 
    alignItems: "center" 
  },
  headerTitle: { 
    fontSize: 16, 
    fontFamily: "SoraTitle-Bold" 
  },
  sectionTitle: { 
    fontSize: 11, 
    fontFamily: "Chirp-Bold", 
    letterSpacing: 1.5, 
    marginLeft: 4 
  },
  card: { 
    flexDirection: "row", 
    alignItems: "flex-start", 
    padding: 16, 
    borderRadius: 20, 
    marginBottom: 12, 
    borderWidth: 1 
  },
  iconBox: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    justifyContent: "center", 
    alignItems: "center", 
    marginRight: 14 
  },
  title: { 
    fontSize: 14, 
    fontFamily: "Chirp-Heavy", 
    marginBottom: 4 
  },
  subtitle: { 
    fontSize: 12, 
    fontFamily: "Chirp-Medium",
    lineHeight: 18
  },
  time: { 
    fontSize: 11, 
    fontFamily: "Chirp-Bold",
    marginTop: 2
  }
});

export default MyActivityScreen;