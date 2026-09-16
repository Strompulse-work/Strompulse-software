⚡ Strompulse - Real-Time Grid Intelligence & Security
A production-grade React Native + Expo application providing zero-latency electricity monitoring and personal safety features. Built specifically to track live grid telemetry and provide emergency SOS capabilities across Nigeria.

🚀 The Upgrade 
Strompulse has evolved from a basic monitoring app into a hybrid-backend powerhouse:

Hybrid Data Layer: Static user data/relationships via Supabase + Zero-Latency IoT hardware streams via Firebase Realtime Database.

Advanced Typography & UI: Custom Glassmorphism UI, integrated Dark/Light themes, and seamless multi-font integration utilizing Chirp and Google's Sora fonts.

Persistent Event Tracking: A custom local storage engine that permanently pairs power outages with their respective restorations.

📱 Core Features
🔌 Real-Time Grid Monitoring
Zero-Latency Telemetry: Live heartbeat tracking via Firebase. Devices missing a ping for 60 seconds are automatically flagged as experiencing a "Power Outage".

Interactive Maps: Visualize device locations with live status indicators (Stable, Outage, Checking) and custom area pinning.

Smart Notifications: Intelligent alert system that pairs historical outages with restorations, generating chronological alert cards with numeric unread badges.

🛡️ Safety & Security
Emergency SOS Protocol: A "Hold-to-Send" concentric ripple button that triggers immediate alerts.

Multi-Channel Delivery: Broadcasts live location and emergency status via in-app push, direct SMS, and WhatsApp DM to primary contacts.

Journey Share: Real-time GPS tracking status overlay for active trips.

Background Triggers: Execute safety alerts without needing to open the app (Android).

🔒 Private Hardware Vault (Stromer)
PIN-Protected Dashboard: Secure access to personal hardware analytics using a lock-screen interface.

Deep Analytics: Donut charts, curved SVG line charts, and weekly uptime bar charts tracking personal power flow.

🏗️ Architecture & Tech Stack
Frontend: React Native, Expo, TypeScript

Navigation: @react-navigation/bottom-tabs & @react-navigation/stack (Custom floating glassmorphism tabs)

Auth & Relational Data: Supabase (PostgreSQL)

Live IoT Telemetry: Firebase Realtime Database

Local Storage: @react-native-async-storage/async-storage (For offline persistence of alerts and settings)

Maps & SVG: react-native-maps, react-native-svg

Typography: expo-font, @expo-google-fonts/sora

📂 Project Structure
Plaintext
src/
├── assets/
│   ├── fonts/               # Local custom fonts (Chirp-Regular, Chirp-Heavy, etc.)
│   └── images/              # App branding and background graphics
├── config/                  
│   ├── supabase.ts          # Supabase client initialization
│   └── firebase.ts          # Firebase Realtime DB initialization
├── services/                
│   ├── authService.ts       # Supabase authentication logic
│   └── deviceService.ts     # Device API wrappers
├── hooks/                   
│   └── useDeviceData.ts     # Core hybrid hook (Supabase + Firebase Sync)
├── navigation/              
│   ├── RootNavigator.tsx    # Stack and Tab navigation routing
│   └── AuthNavigator.tsx    # Pre-auth onboarding routing
├── screens/                 
│   ├── ElectricityScreen.tsx # Live grid map & community list
│   ├── SafetyScreen.tsx      # SOS triggers and journey sharing
│   ├── PrivateDashboard...   # PIN lock & personal hardware analytics
│   ├── NotificationsScreen   # Chronological paired power/security alerts
│   └── ProfileScreen.tsx     # Settings, themes, and user management
├── components/              
│   ├── CustomMapView.tsx    # Map rendering logic
│   └── UIComponents.tsx     # Reusable buttons, loaders, etc.
├── theme/                   
│   └── ThemeContext.tsx     # Dark/Light mode provider
└── types/                   
    └── index.ts             # Global TypeScript interfaces
🛠️ Getting Started
Prerequisites
Node.js 18+

Expo CLI (npm install -g expo-cli)

Supabase Project (PostgreSQL)

Firebase Project (Realtime Database)

Installation
Clone the repository

Bash
git clone https://github.com/Strompulse-work/Strompulse-software.git
cd Strompulse-software
Install Dependencies

Bash
npm install
npx expo install @expo-google-fonts/sora
Configure Environment Variables
Create a .env file in the root directory:

Code snippet
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_FIREBASE_API_KEY=your-firebase-key
EXPO_PUBLIC_FIREBASE_DATABASE_URL=https://your-database.firebaseio.com
Start Development Server

Bash
npx expo start -c
📡 The Hybrid Data Hook
Strompulse utilizes a dual-backend approach to ensure maximum speed without sacrificing relational data integrity.

useAllGridDevices fetches static metadata (Names, Coordinates) from Supabase, and binds it to a zero-latency onValue listener from Firebase root /. The hook strictly calculates a 60-second heartbeat offset to independently verify if grid hardware is online, offline, or experiencing network latency.

🤝 Contributing
Use TypeScript for all new components to maintain strict type safety.

Follow the established theme context for all styling (support isDarkMode).

Limit external dependencies to maintain bundle speed.

Keep SVGs clean and optimized.

📝 License
This project is proprietary software belonging to the Strompulse Platform.

📞 Support
For internal development inquiries or hardware syncing issues:

Contact: support@strompulse.app

Built with ❤️ for a Brighter Grid.
