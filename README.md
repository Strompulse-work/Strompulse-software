# Ibadan Power - Real-Time Electricity Monitoring Platform

A production-grade React Native + Expo application for real-time electricity monitoring across Ibadan City, Nigeria.

## 📱 Features

### Core Features

- **Real-Time Power Status Monitoring**: Live electricity status (ON/OFF/OFFLINE) for connected IoT devices
- **Live Duration Counter**: Tracks how long power has been off in real-time
- **Interactive Maps**: Visualize device locations with status indicators
- **Community Analytics**: Aggregated electricity performance metrics
- **Outage History**: Detailed records of outages with duration and timestamps
- **User Profiles**: Account management with notification preferences
- **Multi-Device Support**: Handle multiple devices per user

### Architecture

- **Bottom Tab Navigation**: 5 main screens (Feed, Map, Communities, Insights, Profile)
- **Real-Time Subscriptions**: Supabase real-time updates for instant status changes
- **Secure Authentication**: Email/password and phone OTP login via Supabase Auth
- **Scalable Services**: Clean separation of concerns with service layers
- **Custom Hooks**: Reusable data fetching and real-time subscription logic
- **Type-Safe**: Full TypeScript with comprehensive type definitions

## 🏗️ Project Structure

```
src/
├── config/              # Configuration files
│   └── supabase.ts      # Supabase client setup
├── services/            # Business logic services
│   ├── authService.ts   # Authentication & session management
│   ├── deviceService.ts # Device & analytics data
│   └── realtimeService.ts# Real-time subscriptions
├── screens/             # Main application screens
│   ├── FeedScreen.tsx   # Home dashboard
│   ├── MapScreen.tsx    # Device location map
│   ├── CommunitiesScreen.tsx # Community stats
│   ├── InsightsScreen.tsx # Analytics & charts
│   ├── ProfileScreen.tsx# User profile
│   └── AuthScreen.tsx   # Authentication
├── components/          # Reusable UI components
│   └── UIComponents.tsx # Status indicators, cards, etc.
├── hooks/               # Custom React hooks
│   └── useDeviceData.ts # Data fetching & subscriptions
├── navigation/          # Navigation setup
│   └── RootNavigator.tsx# Screen routing
├── types/               # TypeScript type definitions
│   └── index.ts         # All interfaces
├── utils/               # Helper functions
│   └── helpers.ts       # Date, status, calculations
└── styles/              # Global styles & theme
    └── theme.ts         # Colors, spacing, typography
```

## 🚀 Getting Started

### Prerequisites

- Node.js 16+ and npm/yarn
- Expo CLI: `npm install -g expo-cli`
- Supabase account with PostgreSQL database
- Google Maps API key (for map features)

### Installation

1. **Clone and Install Dependencies**

```bash
cd ibadan-power-app
cp .env.example .env
npm install
npx expo install
```

2. **Configure Environment Variables**
   Create `.env` in the project root:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your-maps-key
```

3. **Setup Supabase Database**
   Create the following tables in Supabase:

```sql
-- Devices table
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT UNIQUE NOT NULL,
  owner_user_id UUID REFERENCES auth.users(id),
  community_id UUID REFERENCES communities(id),
  address TEXT,
  latitude DECIMAL(10, 6),
  longitude DECIMAL(10, 6),
  status TEXT CHECK (status IN ('ON', 'OFF', 'OFFLINE')),
  last_seen TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Events table (power status changes)
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID REFERENCES devices(id),
  status TEXT CHECK (status IN ('ON', 'OFF')),
  timestamp TIMESTAMP DEFAULT now(),
  created_at TIMESTAMP DEFAULT now()
);

-- Outages table
CREATE TABLE outages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID REFERENCES devices(id),
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  duration_minutes INTEGER,
  is_active BOOLEAN DEFAULT true,
  reason TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Communities table
CREATE TABLE communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  state TEXT,
  city TEXT,
  type TEXT CHECK (type IN ('residential', 'commercial', 'industrial', 'mixed')),
  description TEXT,
  latitude DECIMAL(10, 6),
  longitude DECIMAL(10, 6),
  device_count INTEGER DEFAULT 0,
  admin_id UUID,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

Enable Real-Time on these tables:

- Go to Supabase Dashboard → Replication
- Enable for `events`, `devices`, `outages`, `communities` tables

4. **Start Development Server**

```bash
npm start
```

For specific platforms:

```bash
npm run android  # Run on Android
npm run ios      # Run on iOS
npm run web      # Run on web
```

## 📡 Real-Time Features

### How Real-Time Works

1. Supabase Realtime subscriptions monitor database changes
2. When a device status changes, subscriptions trigger instantly
3. React state updates cause UI re-renders without manual refresh
4. Multiple subscriptions per device ensure comprehensive coverage

### Example: Feed Screen Real-Time Update

```typescript
// Subscribes to device events
const subId = RealtimeService.subscribeToDeviceEvents(deviceId, (payload) => {
  // Called instantly when new events are added to Supabase
  onUpdate(payload);
  setEvents((prev) => [payload.new, ...prev]);
});
```

## 🔐 Authentication Flow

### Email/Password Login

1. User enters credentials on AuthScreen
2. AuthService sends to Supabase Auth
3. Session stored securely in device secure storage
4. User redirected to main app

### Session Management

- Tokens persist across app restarts
- Automatic token refresh before expiration
- Logout clears all stored credentials

## 📊 Data Models

### Device

```typescript
{
  id: string;
  device_id: string; // IoT device identifier
  owner_user_id: string;
  address: string;
  latitude: number;
  longitude: number;
  status: "ON" | "OFF" | "OFFLINE";
  last_seen: string; // ISO timestamp
}
```

### PowerEvent

```typescript
{
  id: string;
  device_id: string;
  status: "ON" | "OFF";
  timestamp: string; // ISO timestamp
}
```

### Outage

```typescript
{
  id: string;
  device_id: string;
  started_at: string;
  ended_at?: string;
  duration_minutes: number;
  is_active: boolean;
}
```

## 🎨 UI Components

### PowerStatusIndicator

Big circular status display with icon and label

```typescript
<PowerStatusIndicator status="ON" size="large" />
```

### DeviceCard

Card showing device with status badge

```typescript
<DeviceCard deviceId="IOT-0001" status="ON" />
```

### StatCard

Dashboard statistic card

```typescript
<StatCard label="Total Outages" value={5} unit="hrs" />
```

### CommunityItem

Collapsible community info with stats

```typescript
<CommunityItem name="Gbagada" deviceCount={150} uptime={94} />
```

## 📈 Charts & Analytics

Using Victory Native for cross-platform charts:

- **7-Day Line Chart**: Power uptime trends
- **30-Day Bar Chart**: Outage frequency
- **Timeline**: Recent outage events

CustomizableCharts are responsive and adapt to screen size.

## 🔧 Production Deployment

### Before Release

- [ ] Add real Google Maps API key
- [ ] Configure correct Supabase project
- [ ] Set up push notifications
- [ ] Enable email notifications
- [ ] Test on real devices
- [ ] Performance optimization (lazy loading)

### Android Build

```bash
eas build --platform android
```

### iOS Build

```bash
eas build --platform ios
```

## 🤝 Contributing

Coding standards:

- Use TypeScript for type safety
- Follow React hooks patterns
- Keep components under 300 lines
- Implement error handling
- Add loading states
- Document Public APIs

## 📝 License

This project is proprietary software for Ibadan Power Monitoring Platform.

## 📞 Support

For issues and questions:

- Create an issue in the repository
- Contact: support@ibadanpower.com

---

**Built with ❤️ for Ibadan City**
