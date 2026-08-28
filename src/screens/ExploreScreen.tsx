/**
 * Explore Screen v3.1 (Dynamic Routing, Live GPS, & Real Maps Integration)
 * Features: Interactive map view toggle, real GPS location sync, dynamic filtering.
 */

import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  ScrollView, 
  TouchableOpacity, 
  Platform 
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useTheme } from "../theme/ThemeContext";
import CustomMapView from "../components/CustomMapView"; // Import our new map component

// --- Mock Data Engine ---
const MOCK_PLACES = [
  { id: "1", name: "Barcelos Ibadan", category: "Restaurants", location: "Bodija", distance: "0.6km", rating: "4.5", reviews: "312", status: "Open now", tags: ["Grills"], isPromoted: true, isFeatured: true, latitude: 7.4160, longitude: 3.9000 },
  { id: "2", name: "Transpec Fitness", category: "Leisure", location: "Jericho", distance: "1.7km", rating: "4.6", reviews: "98", status: "Open now", tags: ["Gym"], isFeatured: true, latitude: 7.4010, longitude: 3.8850 },
  { id: "3", name: "Ibadan City Mall", category: "Leisure", location: "Challenge", distance: "2.1km", rating: "4.2", reviews: "876", status: "Open now", tags: ["Mall"], isFeatured: true, latitude: 7.3820, longitude: 3.8710 },
  { id: "4", name: "Shoprite Ibadan", category: "Restaurants", location: "Dugbe", distance: "2.3km", rating: "4.1", reviews: "631", status: "Open now", tags: ["Food court"], isFeatured: true, latitude: 7.3910, longitude: 3.8900 },
  { id: "5", name: "Premier Hotel", category: "Hotels", location: "New Bodija", distance: "1.1km", rating: "3.8", reviews: "189", status: "Open 24h", tags: ["3-Star"], latitude: 7.4200, longitude: 3.9100 },
  { id: "6", name: "Grand Cubana Hotel", category: "Hotels", location: "GRA", distance: "2.8km", rating: "4.7", reviews: "543", status: "Open 24h", tags: ["5-Star"], latitude: 7.4100, longitude: 3.9200 },
  { id: "7", name: "Lavender Medical Centre", category: "All", location: "Mokola", distance: "2km", rating: "4.4", reviews: "221", status: "Open now", tags: ["Clinic"], latitude: 7.4050, longitude: 3.8950 }, 
  { id: "8", name: "Ventura Leisure Park", category: "Leisure", location: "Agodi Gate", distance: "3.1km", rating: "4.3", reviews: "167", status: "Open now", tags: ["Park"], latitude: 7.4120, longitude: 3.9150 },
  { id: "9", name: "Mr Biggs Ring Road", category: "Restaurants", location: "Ring Road", distance: "1.4km", rating: "3.7", reviews: "441", status: "Open now", tags: ["Fast food"], latitude: 7.3750, longitude: 3.8650 },
];

const CATEGORIES = [
  { name: "All", icon: "compass-outline", color: "#00C48A" },
  { name: "Restaurants", icon: "silverware-fork-knife", color: "#3B82F6" },
  { name: "Hotels", icon: "domain", color: "#D97706" },
  { name: "Leisure", icon: "drama-masks", color: "#8B5CF6" },
];

const ExploreScreen = ({ navigation }: any) => {
  const { theme, isDarkMode } = useTheme();
  const styles = getStyles(theme, isDarkMode);
  
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [isMapView, setIsMapView] = useState(false); // Toggle between List view and Map view
  const [currentLocation, setCurrentLocation] = useState("Locating...");

  // Fetch real-time GPS location
  useEffect(() => {
    const fetchLocation = async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setCurrentLocation("Ibadan");
          return;
        }

        let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        let response = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        if (response && response.length > 0) {
          const addr = response[0];
          setCurrentLocation(addr.district || addr.subregion || addr.city || "Ibadan");
        }
      } catch (e) {
        setCurrentLocation("Ibadan");
      }
    };
    fetchLocation();
  }, []);

  // Filtering Logic (Category + Search Query)
  const getFilteredPlaces = (isFeaturedOnly: boolean = false) => {
    return MOCK_PLACES.filter(place => {
      const matchCategory = activeCategory === "All" || place.category === activeCategory;
      const matchFeatured = isFeaturedOnly ? place.isFeatured : true;
      const matchSearch = place.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          place.location.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCategory && matchFeatured && matchSearch;
    });
  };

  const featuredPlaces = getFilteredPlaces(true);
  const listPlaces = getFilteredPlaces(false);

  return (
    <View style={styles.container}>
      {/* Sticky Header Section */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.titleRow}>
            <MaterialCommunityIcons name="compass" size={28} color={theme.textPrimary} />
            <View style={{ marginLeft: 8 }}>
              <Text style={styles.headerTitle}>Explore Ibadan</Text>
              <Text style={styles.headerSubtitle}>{currentLocation.toUpperCase()} • WITHIN 5KM</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={[styles.mapBtn, isMapView && { backgroundColor: "#00C48A", borderColor: "#00C48A" }]} 
            onPress={() => setIsMapView(!isMapView)}
          >
            <Text style={[styles.mapBtnText, isMapView && { color: "#FFF" }]}>
              {isMapView ? "📋 List" : "🗺 Map"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={20} color={theme.textSecondary} />
          <TextInput 
            placeholder="Search restaurants, hotels, leisure..." 
            placeholderTextColor={theme.textSecondary} 
            style={styles.searchInput} 
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Dynamic Category Routing Row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
          {CATEGORIES.map(cat => {
            const isActive = activeCategory === cat.name;
            return (
              <TouchableOpacity 
                key={cat.name} 
                style={[
                  styles.catChip, 
                  isActive && { borderColor: cat.color, backgroundColor: `${cat.color}15` }
                ]} 
                onPress={() => setActiveCategory(cat.name)}
              >
                <MaterialCommunityIcons 
                  name={cat.icon as any} 
                  size={16} 
                  color={isActive ? cat.color : theme.textSecondary} 
                  style={{ marginRight: 6 }} 
                />
                <Text style={[styles.catText, isActive && { color: cat.color }]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Conditional View: Map View OR Standard Feed View */}
      {isMapView ? (
        <View style={{ flex: 1 }}>
          <CustomMapView 
            style={{ flex: 1 }}
            markers={listPlaces.map(place => ({
              id: place.id,
              title: place.name,
              description: `${place.location} • ⭐ ${place.rating}`,
              latitude: place.latitude,
              longitude: place.longitude,
            }))}
          />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          
          {/* Promoted Banner */}
          {(activeCategory === "All" || activeCategory === "Restaurants") && searchQuery === "" && (
            <TouchableOpacity 
              style={styles.promotedBanner} 
              onPress={() => navigation.navigate("PlaceDetailScreen", { name: "Barcelos Ibadan", status: "outage" })}
            >
              <View style={styles.promotedLeft}>
                 <View style={styles.promotedIconBox}>
                   <MaterialCommunityIcons name="silverware-fork-knife" size={24} color="#0F172A" />
                 </View>
                 <View style={{ flex: 1, marginLeft: 12 }}>
                   <View style={styles.promotedTop}>
                     <Text style={styles.placeTitle}>Barcelos Ibadan</Text>
                     <View style={styles.promotedBadge}><Text style={styles.promotedText}>★ Promoted</Text></View>
                   </View>
                   <Text style={styles.placeDetails}>Bodija • 0.6km away</Text>
                   <Text style={styles.placeRating}>⭐⭐⭐⭐⭐ 4.5 • 312 reviews</Text>
                 </View>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          )}

          {/* Featured Near You (Horizontal Scroll) */}
          {featuredPlaces.length > 0 && searchQuery === "" && (
            <View>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Featured near you</Text>
                <Text style={styles.seeAll}>See all</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.featuredScroll}>
                {featuredPlaces.map(place => (
                  <TouchableOpacity 
                    key={place.id}
                    style={styles.featuredCard} 
                    onPress={() => navigation.navigate("PlaceDetailScreen", { name: place.name, status: "online" })}
                  >
                    <View style={styles.imagePlaceholder}>
                      <View style={styles.featuredAdBadge}><Text style={styles.adText}>Ad</Text></View>
                      {place.category === "Restaurants" && <MaterialCommunityIcons name="silverware-fork-knife" size={40} color="#94A3B8" />}
                      {place.category === "Leisure" && <MaterialCommunityIcons name="drama-masks" size={40} color="#94A3B8" />}
                      {place.category === "Hotels" && <MaterialCommunityIcons name="domain" size={40} color="#94A3B8" />}
                      <Text style={styles.distanceBadge}>{place.distance}</Text>
                    </View>
                    <Text style={styles.featuredTitle}>{place.name}</Text>
                    <Text style={styles.featuredDetails}>{place.location}</Text>
                    <Text style={styles.placeRatingCard}>⭐⭐⭐⭐⭐ {place.rating}</Text>
                    <View style={styles.tagRow}>
                      <Text style={styles.openTag}>{place.status}</Text>
                      <Text style={styles.categoryTag}>{place.tags[0]}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Vertical List View */}
          <View style={[styles.sectionHeaderRow, { marginTop: 24 }]}>
            <Text style={styles.sectionTitle}>{activeCategory === "All" ? "All nearby" : `Nearby • ${activeCategory}`}</Text>
            <Text style={styles.placeCountText}>{listPlaces.length} places</Text>
          </View>

          <View style={styles.verticalList}>
            {listPlaces.length === 0 ? (
              <Text style={{ color: theme.textSecondary, textAlign: "center", marginTop: 20 }}>No locations found.</Text>
            ) : (
              listPlaces.map(place => (
                <TouchableOpacity 
                  key={place.id}
                  style={styles.listCard}
                  onPress={() => navigation.navigate("PlaceDetailScreen", { name: place.name, status: "online" })}
                >
                  <View style={styles.listIconBox}>
                     {place.category === "Restaurants" && <MaterialCommunityIcons name="silverware-fork-knife" size={24} color="#0F172A" />}
                     {place.category === "Leisure" && <MaterialCommunityIcons name="drama-masks" size={24} color="#0F172A" />}
                     {place.category === "Hotels" && <MaterialCommunityIcons name="domain" size={24} color="#0F172A" />}
                     {place.category === "All" && <MaterialCommunityIcons name="hospital-box" size={24} color="#0F172A" />}
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={styles.listTitleRow}>
                      <Text style={styles.listTitle}>{place.name}</Text>
                      {place.isPromoted && <View style={styles.listAdBadge}><Text style={styles.adText}>Ad</Text></View>}
                    </View>
                    <Text style={styles.listDetails}>{place.location} • {place.distance}</Text>
                    <Text style={styles.placeRating}>⭐⭐⭐⭐⭐ {place.rating} • {place.reviews}</Text>
                    <View style={styles.tagRowList}>
                      <Text style={styles.openTag}>{place.status}</Text>
                      <Text style={styles.categoryTag}>{place.tags[0]}</Text>
                    </View>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textSecondary} />
                </TouchableOpacity>
              ))
            )}
          </View>

        </ScrollView>
      )}
    </View>
  );
};

// --- Styles ---
const getStyles = (theme: any, isDarkMode: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 20, backgroundColor: theme.cardBg, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: theme.border },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  titleRow: { flexDirection: "row", alignItems: "center" },
  headerTitle: { fontSize: 22, fontFamily: "Sora_700Bold", color: theme.textPrimary },
  headerSubtitle: { fontSize: 10, fontFamily: "Sora_600SemiBold", color: theme.textSecondary, marginTop: 2, letterSpacing: 0.5 },
  mapBtn: { backgroundColor: "#F1F5F9", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: "#E2E8F0" },
  mapBtnText: { fontSize: 12, fontFamily: "Sora_700Bold", color: "#0F172A" },
  
  searchBar: { flexDirection: "row", alignItems: "center", backgroundColor: theme.background, borderRadius: 12, paddingHorizontal: 12, height: 48, marginBottom: 16, borderWidth: 1, borderColor: theme.border },
  searchInput: { flex: 1, marginLeft: 8, fontFamily: "Sora_400Regular", fontSize: 14, color: theme.textPrimary },
  
  categoryScroll: { flexDirection: "row" },
  catChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: theme.border, marginRight: 8, backgroundColor: theme.background },
  catText: { fontSize: 13, fontFamily: "Sora_700Bold", color: theme.textSecondary },
  
  content: { padding: 20, paddingBottom: 120 },
  
  promotedBanner: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#ECFDF5", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#A7F3D0", marginBottom: 24 },
  promotedLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  promotedIconBox: { width: 48, height: 48, backgroundColor: "#D1FAE5", borderRadius: 12, justifyContent: "center", alignItems: "center" },
  promotedTop: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  promotedBadge: { backgroundColor: "#DBEAFE", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 },
  promotedText: { color: "#1D4ED8", fontSize: 9, fontFamily: "Sora_700Bold" },
  placeTitle: { fontSize: 15, fontFamily: "Sora_700Bold", color: "#0F172A" },
  placeDetails: { fontSize: 11, fontFamily: "Sora_400Regular", color: "#475569", marginBottom: 4 },
  placeRating: { fontSize: 11, fontFamily: "Sora_600SemiBold", color: "#D97706" },
  placeRatingCard: { fontSize: 10, fontFamily: "Sora_600SemiBold", color: "#D97706", marginBottom: 8 },
  
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: "Sora_700Bold", color: theme.textPrimary },
  seeAll: { fontSize: 12, fontFamily: "Sora_700Bold", color: "#00C48A" },
  placeCountText: { fontSize: 11, fontFamily: "Sora_600SemiBold", color: theme.textSecondary },
  
  featuredScroll: { flexDirection: "row", overflow: "visible" },
  featuredCard: { width: 160, backgroundColor: theme.cardBg, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: theme.border, marginRight: 16 },
  imagePlaceholder: { position: "relative", height: 100, backgroundColor: "#F1F5F9", borderRadius: 12, marginBottom: 12, justifyContent: "center", alignItems: "center" },
  featuredAdBadge: { position: "absolute", top: 8, right: 8, backgroundColor: "#EEF2FF", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  adText: { color: "#4F46E5", fontSize: 9, fontFamily: "Sora_700Bold" },
  distanceBadge: { position: "absolute", bottom: 8, left: 8, backgroundColor: "rgba(15, 23, 42, 0.6)", color: "#FFF", fontSize: 10, fontFamily: "Sora_600SemiBold", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, overflow: "hidden" },
  featuredTitle: { fontSize: 14, fontFamily: "Sora_700Bold", marginBottom: 2, color: theme.textPrimary },
  featuredDetails: { fontSize: 11, fontFamily: "Sora_400Regular", color: theme.textSecondary, marginBottom: 4 },
  tagRow: { flexDirection: "row", alignItems: "center" },
  openTag: { fontSize: 9, fontFamily: "Sora_700Bold", color: "#00C48A", backgroundColor: "#ECFDF5", paddingHorizontal: 6, paddingVertical: 4, borderRadius: 4, marginRight: 4 },
  categoryTag: { fontSize: 9, fontFamily: "Sora_600SemiBold", color: "#64748B", backgroundColor: "#F1F5F9", paddingHorizontal: 6, paddingVertical: 4, borderRadius: 4 },
  
  verticalList: { marginTop: 8 },
  listCard: { flexDirection: "row", alignItems: "center", backgroundColor: theme.cardBg, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: theme.border, marginBottom: 12 },
  listIconBox: { width: 48, height: 48, backgroundColor: "#F1F5F9", borderRadius: 12, justifyContent: "center", alignItems: "center" },
  listTitleRow: { flexDirection: "row", alignItems: "center", marginBottom: 2 },
  listTitle: { fontSize: 15, fontFamily: "Sora_700Bold", color: theme.textPrimary },
  listAdBadge: { backgroundColor: "#EEF2FF", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 },
  listDetails: { fontSize: 11, fontFamily: "Sora_400Regular", color: theme.textSecondary, marginBottom: 4 },
  tagRowList: { flexDirection: "row", alignItems: "center", marginTop: 6 },
});

export default ExploreScreen;