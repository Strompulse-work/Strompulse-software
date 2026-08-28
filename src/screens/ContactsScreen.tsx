/**
 * Contacts Screen v3.0
 * Features: Matches prd4.png strictly with Sora typography and clean layout.
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
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";

const ContactsScreen = ({ navigation }: any) => {
  const { theme, isDarkMode } = useTheme();
  const styles = getStyles(theme);

  const activeContacts = [
    { id: "1", initial: "M", name: "Mum", role: "Family", color: "#F59E0B", bg: "#FEF3C7" },
    { id: "2", initial: "T", name: "Tunde", role: "Friend", color: "#3B82F6", bg: "#DBEAFE" },
    { id: "3", initial: "S", name: "Sola", role: "Neighbour", color: "#8B5CF6", bg: "#F3E8FF" },
  ];

  const inviteContacts = [
    { id: "4", initial: "D", name: "Dr. Ade", phone: "+234 901 234 5678", color: "#00C48A", bg: "#ECFDF5" },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} activeOpacity={0.7} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contacts</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* On Strompulse Section */}
        <Text style={styles.sectionTitle}>ON STROMPULSE</Text>
        <View style={styles.contactsList}>
          {activeContacts.map((contact) => (
            <View key={contact.id} style={styles.contactCard}>
              <View style={styles.contactLeft}>
                <View style={styles.avatarContainer}>
                  <View style={[styles.avatar, { backgroundColor: contact.bg }]}>
                    <Text style={[styles.avatarText, { color: contact.color }]}>{contact.initial}</Text>
                  </View>
                  <View style={styles.onlineIndicator} />
                </View>
                <View>
                  <Text style={styles.contactName}>{contact.name}</Text>
                  <Text style={styles.contactSub}>{contact.role}</Text>
                </View>
              </View>
              <View style={styles.activePill}>
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
                <View style={styles.avatarContainer}>
                  <View style={[styles.avatar, { backgroundColor: contact.bg }]}>
                    <Text style={[styles.avatarText, { color: contact.color }]}>{contact.initial}</Text>
                  </View>
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

      </ScrollView>
    </View>
  );
};

const getStyles = (theme: any) =>
  StyleSheet.create({
    container: { 
      flex: 1, 
      backgroundColor: theme.background 
    },
    header: { 
      flexDirection: "row", 
      alignItems: "center", 
      paddingHorizontal: 20, 
      marginTop: Platform.OS === "ios" ? 60 : 40, 
      marginBottom: 32 
    },
    backButton: { 
      width: 44, 
      height: 44, 
      borderRadius: 12, 
      borderWidth: 1, 
      borderColor: theme.border, 
      justifyContent: "center", 
      alignItems: "center", 
      backgroundColor: theme.cardBg, 
      marginRight: 16 
    },
    headerTitle: { 
      fontSize: 22, 
      fontFamily: "Sora_700Bold", 
      color: theme.textPrimary 
    },
    scrollContent: { 
      paddingHorizontal: 20, 
      paddingBottom: 40 
    },
    sectionTitle: { 
      fontSize: 11, 
      fontFamily: "Sora_700Bold", 
      color: theme.textSecondary, 
      letterSpacing: 1.5, 
      marginBottom: 12, 
      marginLeft: 4 
    },
    contactsList: { 
      marginBottom: 24 
    },
    contactCard: { 
      flexDirection: "row", 
      justifyContent: "space-between", 
      alignItems: "center", 
      backgroundColor: theme.cardBg, 
      borderRadius: 16, 
      borderWidth: 1, 
      borderColor: theme.border, 
      padding: 16, 
      marginBottom: 12 
    },
    contactLeft: { 
      flexDirection: "row", 
      alignItems: "center" 
    },
    avatarContainer: {
      position: "relative",
      marginRight: 16,
    },
    avatar: { 
      width: 48, 
      height: 48, 
      borderRadius: 24, 
      justifyContent: "center", 
      alignItems: "center", 
      borderWidth: 1, 
      borderColor: "rgba(0,0,0,0.05)"
    },
    avatarText: { 
      fontSize: 20, 
      fontFamily: "Sora_700Bold" 
    },
    onlineIndicator: { 
      position: "absolute", 
      bottom: 0, 
      right: 0, 
      width: 12, 
      height: 12, 
      borderRadius: 6, 
      backgroundColor: "#00C48A", 
      borderWidth: 2, 
      borderColor: theme.cardBg 
    },
    contactName: { 
      fontSize: 15, 
      fontFamily: "Sora_700Bold", 
      color: theme.textPrimary, 
      marginBottom: 4 
    },
    contactSub: { 
      fontSize: 12, 
      fontFamily: "Sora_400Regular", 
      color: theme.textSecondary 
    },
    activePill: { 
      backgroundColor: "#ECFDF5", 
      paddingHorizontal: 12, 
      paddingVertical: 6, 
      borderRadius: 12 
    },
    activePillText: { 
      fontSize: 12, 
      fontFamily: "Sora_700Bold", 
      color: "#00C48A" 
    },
    invitePill: { 
      backgroundColor: "#EEF2FF", 
      paddingHorizontal: 16, 
      paddingVertical: 8, 
      borderRadius: 12 
    },
    invitePillText: { 
      fontSize: 12, 
      fontFamily: "Sora_700Bold", 
      color: "#6366F1" 
    },
    inviteInputContainer: { 
      flexDirection: "row", 
      justifyContent: "space-between", 
      alignItems: "center", 
      backgroundColor: theme.background, 
      borderRadius: 12, 
      borderWidth: 1, 
      borderColor: theme.border, 
      paddingLeft: 16, 
      paddingRight: 8, 
      paddingVertical: 8, 
      marginBottom: 20 
    },
    inviteLinkText: { 
      flex: 1, 
      fontSize: 13, 
      fontFamily: "Sora_400Regular", 
      color: theme.textSecondary, 
      marginRight: 12 
    },
    copyButtonContainer: { 
      backgroundColor: "#EEF2FF", 
      paddingHorizontal: 16, 
      paddingVertical: 8, 
      borderRadius: 8 
    },
    copyButtonText: { 
      fontSize: 12, 
      fontFamily: "Sora_700Bold", 
      color: "#6366F1"
    },
  });

export default ContactsScreen;