/**
 * Contacts Screen v2.0
 * Features: Split network views, invite management, and 2x2 sharing utility grid.
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";

const ContactsScreen = ({ navigation }: any) => {
  const { theme, isDarkMode } = useTheme();
  const styles = getStyles(theme);

  const activeContacts = [
    { id: "1", initial: "M", name: "Mum", role: "Family", color: "#F59E0B" },
    { id: "2", initial: "T", name: "Tunde", role: "Friend", color: "#3B82F6" },
    { id: "3", initial: "S", name: "Sola", role: "Neighbour", color: "#8B5CF6" },
  ];

  const inviteContacts = [
    { id: "4", initial: "D", name: "Dr. Ade", phone: "+234 901 234 5678", color: "#06B6D4" },
    { id: "5", initial: "P", name: "P. Yemi", phone: "+234 816 777 8899", color: "#EF4444" },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} activeOpacity={0.7} onPress={() => navigation.goBack()}>
          <Feather name="chevron-left" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Contacts</Text>
          <Text style={styles.headerSubtitle}>NETWORK & INVITES</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* On Strompulse Section */}
        <Text style={styles.sectionTitle}>ON STROMPULSE</Text>
        <View style={styles.contactsList}>
          {activeContacts.map((contact) => (
            <View key={contact.id} style={styles.contactCard}>
              <View style={styles.contactLeft}>
                <View style={[styles.avatar, { borderColor: contact.color }]}>
                  <Text style={[styles.avatarText, { color: contact.color }]}>{contact.initial}</Text>
                  <View style={styles.onlineIndicator} />
                </View>
                <View>
                  <Text style={styles.contactName}>{contact.name}</Text>
                  <Text style={styles.contactSub}>{contact.role}</Text>
                </View>
              </View>
              <View style={styles.activePill}>
                <MaterialCommunityIcons name="shield-check-outline" size={14} color="#00C48A" />
                <Text style={styles.activePillText}>Active</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Not On Strompulse Section */}
        <Text style={styles.sectionTitle}>NOT ON STROMPULSE</Text>
        <View style={styles.contactsList}>
          {inviteContacts.map((contact) => (
            <View key={contact.id} style={styles.contactCard}>
              <View style={styles.contactLeft}>
                <View style={[styles.avatar, { borderColor: contact.color }]}>
                  <Text style={[styles.avatarText, { color: contact.color }]}>{contact.initial}</Text>
                </View>
                <View>
                  <Text style={styles.contactName}>{contact.name}</Text>
                  <Text style={styles.contactSub}>{contact.phone}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.invitePill} activeOpacity={0.7}>
                <Text style={styles.invitePillText}>Invite</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Your Invite Link Section */}
        <Text style={styles.sectionTitle}>YOUR INVITE LINK</Text>
        <View style={styles.inviteInputContainer}>
          <Text style={styles.inviteLinkText} numberOfLines={1}>strompulse.de/invite/awoniyi-7x3k</Text>
          <TouchableOpacity style={styles.copyButtonContainer} activeOpacity={0.7}>
            <Text style={styles.copyButtonText}>Copy</Text>
          </TouchableOpacity>
        </View>

        {/* Share Utility Grid */}
        <View style={styles.shareGrid}>
          <TouchableOpacity style={styles.shareGridItem} activeOpacity={0.7}>
            <MaterialCommunityIcons name="whatsapp" size={24} color="#00C48A" style={styles.shareIcon} />
            <Text style={[styles.shareText, { color: "#00C48A" }]}>WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareGridItem} activeOpacity={0.7}>
            <Feather name="smartphone" size={24} color="#3B82F6" style={styles.shareIcon} />
            <Text style={[styles.shareText, { color: "#3B82F6" }]}>SMS</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareGridItem} activeOpacity={0.7}>
            <Feather name="link" size={24} color="#F97316" style={styles.shareIcon} />
            <Text style={[styles.shareText, { color: "#F97316" }]}>Share Link</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareGridItem} activeOpacity={0.7}>
            <Feather name="copy" size={24} color="#8B5CF6" style={styles.shareIcon} />
            <Text style={[styles.shareText, { color: "#8B5CF6" }]}>Copy Card</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const getStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 24, marginTop: Platform.OS === "ios" ? 60 : 40, marginBottom: 32 },
    backButton: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, borderColor: theme.border, justifyContent: "center", alignItems: "center", backgroundColor: theme.cardBg, marginRight: 16 },
    headerTextContainer: { flex: 1 },
    headerTitle: { fontSize: 24, fontWeight: "800", fontFamily: "Arial", color: theme.textPrimary, letterSpacing: -0.5 },
    headerSubtitle: { fontSize: 10, fontWeight: "800", fontFamily: "Arial", color: theme.textSecondary, letterSpacing: 1, marginTop: 2 },
    scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },
    sectionTitle: { fontSize: 11, fontWeight: "800", fontFamily: "Arial", color: theme.textSecondary, letterSpacing: 1, marginBottom: 12, marginLeft: 4 },
    contactsList: { marginBottom: 32 },
    contactCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: theme.cardBg, borderRadius: 16, borderWidth: 1, borderColor: theme.border, padding: 16, marginBottom: 12 },
    contactLeft: { flexDirection: "row", alignItems: "center" },
    avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(255, 255, 255, 0.02)", marginRight: 16, position: "relative" },
    avatarText: { fontSize: 18, fontWeight: "800", fontFamily: "Arial" },
    onlineIndicator: { position: "absolute", bottom: 0, right: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: "#00C48A", borderWidth: 2, borderColor: theme.cardBg },
    contactName: { fontSize: 16, fontWeight: "800", fontFamily: "Arial", color: theme.textPrimary, marginBottom: 4 },
    contactSub: { fontSize: 12, fontFamily: "Arial", color: theme.textSecondary },
    activePill: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0, 196, 138, 0.1)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: "rgba(0, 196, 138, 0.3)" },
    activePillText: { fontSize: 12, fontWeight: "700", fontFamily: "Arial", color: "#00C48A", marginLeft: 4 },
    invitePill: { backgroundColor: "rgba(59, 130, 246, 0.1)", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: "rgba(59, 130, 246, 0.3)" },
    invitePillText: { fontSize: 12, fontWeight: "700", fontFamily: "Arial", color: "#3B82F6" },
    inviteInputContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: theme.background, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingLeft: 16, paddingRight: 8, paddingVertical: 8, marginBottom: 20 },
    inviteLinkText: { flex: 1, fontSize: 13, fontFamily: "Arial", color: theme.textSecondary, marginRight: 12 },
    copyButtonContainer: { backgroundColor: "rgba(255, 255, 255, 0.05)", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.1)" },
    copyButtonText: { fontSize: 12, fontWeight: "700", color: "#3B82F6", fontFamily: "Arial" },
    shareGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 12 },
    shareGridItem: { width: "48%", backgroundColor: theme.cardBg, borderRadius: 16, borderWidth: 1, borderColor: theme.border, padding: 16 },
    shareIcon: { marginBottom: 16 },
    shareText: { fontSize: 14, fontWeight: "800", fontFamily: "Arial" },
  });

export default ContactsScreen;