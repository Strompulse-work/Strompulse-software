import React from "react";
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Platform, Linking, Alert } from "react-native";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";

const HelpSupportScreen = ({ navigation }: any) => {
  const { theme, isDarkMode } = useTheme();

  const handleSupport = () => {
    Linking.openURL("whatsapp://send?text=Hello%20Strompulse,%20I%20need%20help%20with...").catch(() => Alert.alert("WhatsApp not found", "Please install WhatsApp to contact support."));
  };

  const faqs = [
    { q: "How accurate is the grid map?", a: "Regional grid accuracy is approximately 70% based on crowd-sourced sensors. For 100% accuracy, purchase a Personal Hardware Node." },
    { q: "How do I request a hardware node?", a: "Navigate to the 'Stromer' tab or check 'My Subscriptions' to order a plug-and-play device." },
    { q: "Is the app totally free?", a: "Yes, the digital tracking app and community alerts are completely free to use." },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDarkMode ? "#0B0F0D" : "#F4F6F8" }}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Help & Support</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 24 }}>
        
        {/* Contact Support Card */}
        <View style={[styles.contactCard, { backgroundColor: isDarkMode ? "#121A16" : "#FFFFFF", borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0" }]}>
          <View style={[styles.iconWrapper, { backgroundColor: isDarkMode ? "rgba(0,196,138,0.1)" : "#ECFDF5" }]}>
            <MaterialCommunityIcons name="chat-question" size={28} color="#00C48A" />
          </View>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Need immediate help?</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Our support team is available 24/7 to assist you with your devices and app issues.</Text>
          
          <TouchableOpacity style={[styles.chatBtn, { backgroundColor: isDarkMode ? "#FFFFFF" : "#000000" }]} onPress={handleSupport}>
            <Feather name="message-circle" size={18} color={isDarkMode ? "#000" : "#FFF"} style={{ marginRight: 8 }} />
            <Text style={[styles.chatText, { color: isDarkMode ? "#000" : "#FFF" }]}>Chat with us</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>FREQUENTLY ASKED QUESTIONS</Text>
        
        {faqs.map((faq, idx) => (
          <View key={idx} style={[styles.faqCard, { backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF" }]}>
            <Text style={[styles.faqQ, { color: theme.textPrimary }]}>{faq.q}</Text>
            <Text style={[styles.faqA, { color: theme.textSecondary }]}>{faq.a}</Text>
          </View>
        ))}

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 20 : 10, paddingBottom: 10 },
  iconBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 16, fontFamily: "SoraTitle-Bold" },
  contactCard: { padding: 24, borderRadius: 24, borderWidth: 1, alignItems: "center", marginBottom: 32 },
  iconWrapper: { width: 64, height: 64, borderRadius: 32, justifyContent: "center", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 18, fontFamily: "Chirp-Heavy", marginBottom: 8, textAlign: "center" },
  subtitle: { fontSize: 13, fontFamily: "Chirp-Medium", textAlign: "center", lineHeight: 20, marginBottom: 24 },
  chatBtn: { flexDirection: "row", width: "100%", height: 50, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  chatText: { fontFamily: "Chirp-Bold", fontSize: 14 },
  sectionTitle: { fontSize: 11, fontFamily: "Chirp-Bold", letterSpacing: 1.5, marginBottom: 16, marginLeft: 4 },
  faqCard: { padding: 20, borderRadius: 20, marginBottom: 12 },
  faqQ: { fontSize: 14, fontFamily: "Chirp-Bold", marginBottom: 8 },
  faqA: { fontSize: 13, fontFamily: "Chirp-Medium", lineHeight: 20 }
});

export default HelpSupportScreen;