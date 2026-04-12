# Database Schema Documentation

## Overview

PostgreSQL database hosted on Supabase with real-time capabilities enabled.

## Tables

### 1. users (via Supabase Auth)

Built-in Supabase authentication table. User profiles extend this.

**Columns:**

- `id` (UUID) - Primary key
- `email` (TEXT) - User email
- `phone` (TEXT) - User phone number
- `user_metadata` (JSONB) - Custom user data (full_name, role, avatar_url)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

---

### 2. devices

IoT devices installed at customer premises

**Columns:**
| Column | Type | Constraints | Description |
|--------|------|-----------|-------------|
| id | UUID | PRIMARY KEY | Unique device record ID |
| device_id | TEXT | UNIQUE, NOT NULL | IoT device identifier (e.g., IOT-0001) |
| owner_user_id | UUID | FOREIGN KEY (users.id) | Device owner |
| community_id | UUID | FOREIGN KEY (communities.id) | Community assignment |
| address | TEXT | - | Physical address |
| latitude | DECIMAL(10,6) | - | GPS latitude |
| longitude | DECIMAL(10,6) | - | GPS longitude |
| status | TEXT | CHECK (ON, OFF, OFFLINE) | Current power status |
| last_seen | TIMESTAMP | - | Last signal received |
| created_at | TIMESTAMP | DEFAULT now() | Creation time |
| updated_at | TIMESTAMP | DEFAULT now() | Last update |

**Indexes:**

```sql
CREATE INDEX idx_devices_owner ON devices(owner_user_id);
CREATE INDEX idx_devices_community ON devices(community_id);
CREATE INDEX idx_devices_device_id ON devices(device_id);
```

---

### 3. events

Individual power status change events from IoT devices

**Columns:**
| Column | Type | Constraints | Description |
|--------|------|-----------|-------------|
| id | UUID | PRIMARY KEY | - |
| device_id | UUID | FOREIGN KEY (devices.id) | Device reporting |
| status | TEXT | CHECK (ON, OFF) | Status change (ON or OFF) |
| timestamp | TIMESTAMP | NOT NULL | When the change occurred |
| created_at | TIMESTAMP | DEFAULT now() | Record creation |

**Purpose:** Raw events from MQTT broker processed by backend

**Indexes:**

```sql
CREATE INDEX idx_events_device ON events(device_id);
CREATE INDEX idx_events_timestamp ON events(timestamp DESC);
```

**Real-Time:** ✅ ENABLED - Broadcasts all INSERT/UPDATE/DELETE

---

### 4. outages

Calculated outage records (OFF periods)

**Columns:**
| Column | Type | Constraints | Description |
|--------|------|-----------|-------------|
| id | UUID | PRIMARY KEY | - |
| device_id | UUID | FOREIGN KEY (devices.id) | Device that went offline |
| started_at | TIMESTAMP | NOT NULL | Outage start time |
| ended_at | TIMESTAMP | - | Outage end time (NULL if ongoing) |
| duration_minutes | INTEGER | - | Calculated duration |
| is_active | BOOLEAN | DEFAULT true | Whether outage is ongoing |
| reason | TEXT | - | Outage reason (if known) |
| created_at | TIMESTAMP | DEFAULT now() | - |
| updated_at | TIMESTAMP | DEFAULT now() | - |

**Purpose:** Aggregated outage data derived from events table

**Note:** Should be populated by backend service processing events

**Indexes:**

```sql
CREATE INDEX idx_outages_device ON outages(device_id);
CREATE INDEX idx_outages_started_at ON outages(started_at DESC);
CREATE INDEX idx_outages_is_active ON outages(is_active);
```

**Real-Time:** ✅ ENABLED

---

### 5. communities

Geographic communities with aggregated statistics

**Columns:**
| Column | Type | Constraints | Description |
|--------|------|-----------|-------------|
| id | UUID | PRIMARY KEY | - |
| name | TEXT | NOT NULL | Community name (e.g., "Gbagada") |
| state | TEXT | - | State (e.g., "Oyo") |
| city | TEXT | - | City (e.g., "Ibadan") |
| type | TEXT | CHECK (residential, commercial, industrial, mixed) | Community type |
| description | TEXT | - | Community info |
| latitude | DECIMAL(10,6) | - | Center GPS latitude |
| longitude | DECIMAL(10,6) | - | Center GPS longitude |
| device_count | INTEGER | DEFAULT 0 | Total devices |
| admin_id | UUID | - | Community admin user |
| created_at | TIMESTAMP | DEFAULT now() | - |
| updated_at | TIMESTAMP | DEFAULT now() | - |

**Current Communities (Ibadan):**

- Gbagada
- Lekki
- Abakaliki
- Jericho
- Agodi
- Bodija
- Alkababa Junction

**Indexes:**

```sql
CREATE INDEX idx_communities_name ON communities(name);
```

---

### 6. daily_stats (Optional)

Pre-calculated daily statistics for performance

**Columns:**
| Column | Type | Constraints |
|--------|------|-----------|
| id | UUID | PRIMARY KEY |
| device_id | UUID | FOREIGN KEY |
| date | DATE | - |
| total_events | INTEGER | - |
| outage_count | INTEGER | - |
| total_outage_minutes | INTEGER | - |
| uptime_percentage | DECIMAL | - |
| created_at | TIMESTAMP | - |

**Note:** Not required for MVP, use for optimization

---

## Relationships Diagram

```
┌─────────────┐
│    users    │
│  (Supabase) │
└──────┬──────┘
       │
       │ owns
       │
       ├─────────────┐
       │             │
    (1)│           (many)
       ▼             │
   ┌────────────┐    │
   │  devices   │◄───┘
   └─────┬──────┘
         │
      (1)│ 1:many
         │
      (many)▼
    ┌────────────┐
    │   events   │
    └────────────┘

    ┌────────────┐
    │  devices   │◄─── references ── ┌────────────┐
    └────────────┘                    │communities │
                                      └────────────┘

   ┌──────────┐
   │ outages  │
   └────┬─────┘
        │
        │ (1:many)
        │
        ▼
    ┌────────────┐
    │  devices   │
    └────────────┘
```

---

## Row Level Security (RLS) Policies

### devices

```sql
-- Users can see their own devices
CREATE POLICY "Users see own devices" ON devices
  USING (owner_user_id = auth.uid());

-- Users can see community devices if admin
CREATE POLICY "Admins see community devices" ON devices
  USING (
    community_id IN (
      SELECT id FROM communities WHERE admin_id = auth.uid()
    )
  );
```

### events

```sql
-- Users see events for their devices
CREATE POLICY "Users see own device events" ON events
  USING (
    device_id IN (
      SELECT id FROM devices WHERE owner_user_id = auth.uid()
    )
  );
```

### outages

```sql
-- Users see outages for their devices
CREATE POLICY "Users see own device outages" ON outages
  USING (
    device_id IN (
      SELECT id FROM devices WHERE owner_user_id = auth.uid()
    )
  );
```

---

## Real-Time Subscriptions Configuration

Enable for production:

1. Go to Supabase Dashboard
2. Database → Replication
3. Enable for tables: `devices`, `events`, `outages`, `communities`

---

## Queries & Performance Tips

### Get recent Events

```sql
SELECT * FROM events
WHERE device_id = 'device-id'
ORDER BY timestamp DESC
LIMIT 10;
```

**Index:** `idx_events_device`, `idx_events_timestamp`

### Calculate Current Uptime

```sql
SELECT
  d.id,
  d.status,
  COUNT(CASE WHEN e.status = 'OFF' THEN 1 END) as outage_count,
  SUM(o.duration_minutes) as total_outage_minutes
FROM devices d
LEFT JOIN events e ON d.id = e.device_id
  AND e.timestamp > NOW() - INTERVAL '7 days'
LEFT JOIN outages o ON d.id = o.device_id
  AND o.started_at > NOW() - INTERVAL '7 days'
GROUP BY d.id, d.status;
```

### Get Community Stats

```sql
SELECT
  c.id,
  c.name,
  COUNT(d.id) as total_devices,
  COUNT(CASE WHEN d.status = 'ON' THEN 1 END) as online_devices,
  COUNT(CASE WHEN d.status = 'OFFLINE' THEN 1 END) as offline_devices,
  COUNT(CASE WHEN o.is_active THEN 1 END) as active_outages
FROM communities c
LEFT JOIN devices d ON c.id = d.community_id
LEFT JOIN outages o ON d.id = o.device_id
GROUP BY c.id, c.name;
```

---

## Backend Service Responsibilities

The Node.js/Python backend should:

1. **Listen to MQTT Topic:** `devices/{device_id}/status`
2. **When ON event:**
   - Find active outage for device
   - Set `ended_at` and `is_active = false`
   - Calculate `duration_minutes`

3. **When OFF event:**
   - Create new outage record with `started_at = now()`
   - Set `is_active = true`

4. **Device Offline Detection:**
   - Scheduled job checks `last_seen`
   - If > 15 minutes, update device status to OFFLINE

---

## Sample SQL Setup Script

```sql
-- Create tables
CREATE TABLE IF NOT EXISTS devices (...);
CREATE TABLE IF NOT EXISTS events (...);
CREATE TABLE IF NOT EXISTS outages (...);
CREATE TABLE IF NOT EXISTS communities (...);

-- Create indexes
CREATE INDEX idx_devices_owner ON devices(owner_user_id);
CREATE INDEX idx_devices_community ON devices(community_id);
CREATE INDEX idx_events_device ON events(device_id);
CREATE INDEX idx_events_timestamp ON events(timestamp DESC);
CREATE INDEX idx_outages_device ON outages(device_id);
CREATE INDEX idx_outages_is_active ON outages(is_active);

-- Enable RLS
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE outages ENABLE ROW LEVEL SECURITY;

-- Create policies (see above)
...
```
