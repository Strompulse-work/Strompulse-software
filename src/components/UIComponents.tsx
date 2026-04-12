/**
 * Reusable UI Components
 * Core building blocks for all screens
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ViewStyle,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import {
  Colors,
  GlobalStyles,
  Spacing,
  Typography,
  BorderRadius,
} from "../styles/theme";
import { PowerStatus } from "../types";
import { getStatusColor, getStatusIcon } from "../utils/helpers";

const { width: screenWidth } = Dimensions.get("screen");

// ============ POWER STATUS INDICATOR ============
interface PowerStatusIndicatorProps {
  status: PowerStatus;
  size?: "small" | "medium" | "large";
  showLabel?: boolean;
}

export const PowerStatusIndicator: React.FC<PowerStatusIndicatorProps> = ({
  status,
  size = "medium",
  showLabel = true,
}) => {
  const sizeMap = {
    small: 40,
    medium: 80,
    large: 120,
  };

  const iconSizeMap = {
    small: 20,
    medium: 40,
    large: 60,
  };

  const diameter = sizeMap[size];
  const iconSize = iconSizeMap[size];
  const color = getStatusColor(status);
  const iconName = getStatusIcon(status);

  return (
    <View style={styles.indicatorContainer}>
      <View
        style={[
          styles.statusCircle,
          {
            width: diameter,
            height: diameter,
            borderRadius: diameter / 2,
            backgroundColor: color,
          },
        ]}
      >
        <MaterialIcons name={iconName as any} size={iconSize} color="white" />
      </View>
      {showLabel && (
        <Text style={[styles.statusLabel, { color, marginTop: Spacing.md }]}>
          {status}
        </Text>
      )}
    </View>
  );
};

// ============ DEVICE CARD ============
interface DeviceCardProps {
  deviceId: string;
  address: string;
  status: PowerStatus;
  lastSeen: string;
  onPress?: () => void;
  additionalInfo?: string;
}

export const DeviceCard: React.FC<DeviceCardProps> = ({
  deviceId,
  address,
  status,
  lastSeen,
  onPress,
  additionalInfo,
}) => {
  return (
    <TouchableOpacity
      style={[GlobalStyles.card, styles.deviceCard]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={GlobalStyles.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text style={GlobalStyles.h3} numberOfLines={1}>
            {deviceId}
          </Text>
          <Text
            style={[GlobalStyles.bodySmall, { marginTop: Spacing.xs }]}
            numberOfLines={2}
          >
            {address}
          </Text>
          {additionalInfo && (
            <Text style={[GlobalStyles.caption, { marginTop: Spacing.xs }]}>
              {additionalInfo}
            </Text>
          )}
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(status) },
          ]}
        >
          <Text style={styles.statusBadgeText}>{status}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ============ OUTAGE EVENT ITEM ============
interface OutageEventItemProps {
  duration: string;
  startTime: string;
  endTime: string;
}

export const OutageEventItem: React.FC<OutageEventItemProps> = ({
  duration,
  startTime,
  endTime,
}) => {
  return (
    <View style={[GlobalStyles.card, styles.eventItem]}>
      <View style={GlobalStyles.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text style={GlobalStyles.label}>Duration</Text>
          <Text
            style={[
              GlobalStyles.h3,
              { color: Colors.error, marginTop: Spacing.xs },
            ]}
          >
            {duration}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={GlobalStyles.label}>Started</Text>
          <Text style={[GlobalStyles.body, { marginTop: Spacing.xs }]}>
            {startTime}
          </Text>
        </View>
      </View>
      <View style={[GlobalStyles.rowBetween, { marginTop: Spacing.md }]}>
        <View style={{ flex: 1 }}>
          <Text style={GlobalStyles.label}>Ended</Text>
          <Text style={[GlobalStyles.body, { marginTop: Spacing.xs }]}>
            {endTime}
          </Text>
        </View>
      </View>
    </View>
  );
};

// ============ STAT CARD ============
interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon?: string;
  color?: string;
  style?: ViewStyle;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  unit,
  icon,
  color = Colors.primary,
  style,
}) => {
  return (
    <View style={[GlobalStyles.card, styles.statCard, style]}>
      {icon && (
        <MaterialIcons
          name={icon as any}
          size={24}
          color={color}
          style={{ marginBottom: Spacing.sm }}
        />
      )}
      <Text style={GlobalStyles.label}>{label}</Text>
      <View style={GlobalStyles.rowCenter}>
        <Text style={[GlobalStyles.h2, { color, marginTop: Spacing.xs }]}>
          {value}
        </Text>
        {unit && (
          <Text
            style={[
              GlobalStyles.body,
              { color: Colors.text.secondary, marginLeft: Spacing.xs },
            ]}
          >
            {unit}
          </Text>
        )}
      </View>
    </View>
  );
};

// ============ COMMUNITY ITEM ============
interface CommunityItemProps {
  name: string;
  deviceCount: number;
  uptime: number;
  status: "healthy" | "warning" | "critical";
  onPress?: () => void;
}

export const CommunityItem: React.FC<CommunityItemProps> = ({
  name,
  deviceCount,
  uptime,
  status,
  onPress,
}) => {
  const statusColor =
    status === "healthy"
      ? Colors.success
      : status === "warning"
        ? Colors.warning
        : Colors.error;

  return (
    <TouchableOpacity
      style={[GlobalStyles.card, styles.communityItem]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={GlobalStyles.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text style={GlobalStyles.h3}>{name}</Text>
          <Text
            style={[GlobalStyles.bodySmall, { marginTop: Spacing.xs }]}
          >{`${deviceCount} device${deviceCount !== 1 ? "s" : ""}`}</Text>
        </View>
        <View style={styles.statusIndicator}>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: statusColor,
              },
            ]}
          />
        </View>
      </View>
      <View style={[styles.progressBar, { marginTop: Spacing.md }]}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${Math.min(uptime, 100)}%`,
              backgroundColor: statusColor,
            },
          ]}
        />
      </View>
      <Text
        style={[
          GlobalStyles.caption,
          { marginTop: Spacing.xs, color: statusColor },
        ]}
      >{`${Math.round(uptime)}% uptime`}</Text>
    </TouchableOpacity>
  );
};

// ============ LOADING COMPONENT ============
interface LoadingProps {
  message?: string;
  size?: number | "small" | "medium" | "large";
}

export const Loading: React.FC<LoadingProps> = ({
  message = "Loading...",
  size = "medium",
}) => {
  const sizeMap = {
    small: 20,
    medium: 40,
    large: 60,
  };

  const iconSize = typeof size === "number" ? size : sizeMap[size];

  return (
    <View style={styles.loadingContainer}>
      <MaterialIcons
        name="hourglass-empty"
        size={iconSize}
        color={Colors.primary}
      />
      <Text style={[GlobalStyles.body, { marginTop: Spacing.sm }]}>
        {message}
      </Text>
    </View>
  );
};

// ============ ERROR MESSAGE COMPONENT ============
interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  message,
  onRetry,
}) => {
  return (
    <View style={styles.errorContainer}>
      <MaterialIcons name="error-outline" size={48} color={Colors.status.off} />
      <Text style={[GlobalStyles.body, styles.errorText]}>{message}</Text>
      {onRetry && (
        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
          <Text style={[GlobalStyles.button, { color: Colors.background }]}>
            Retry
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ============ SECTION HEADER COMPONENT ============
interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: {
    label: string;
    onPress: () => void;
  };
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  action,
}) => {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderText}>
        <Text style={GlobalStyles.h3}>{title}</Text>
        {subtitle && (
          <Text
            style={[GlobalStyles.caption, { color: Colors.text.secondary }]}
          >
            {subtitle}
          </Text>
        )}
      </View>
      {action && (
        <TouchableOpacity onPress={action.onPress}>
          <Text style={[GlobalStyles.button, { color: Colors.primary }]}>
            {action.label}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ============ ADDITIONAL STYLES ============
const styles = StyleSheet.create({
  ...GlobalStyles,
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  indicatorContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  statusCircle: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 8,
  },
  statusLabel: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
  deviceCard: {
    marginVertical: Spacing.sm,
    marginHorizontal: Spacing.lg,
  },
  statusBadge: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    marginLeft: Spacing.md,
  },
  statusBadgeText: {
    color: "white",
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
  },
  eventItem: {
    marginVertical: Spacing.sm,
    marginHorizontal: Spacing.lg,
  },
  statCard: {
    flex: 1,
    marginHorizontal: Spacing.sm,
    marginVertical: Spacing.sm,
    minHeight: 120,
  },
  communityItem: {
    marginVertical: Spacing.sm,
    marginHorizontal: Spacing.lg,
  },
  statusIndicator: {
    alignItems: "center",
    justifyContent: "center",
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  progressBar: {
    height: 6,
    backgroundColor: Colors.backgroundDark,
    borderRadius: BorderRadius.full,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: BorderRadius.full,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  errorText: {
    color: Colors.status.off,
    textAlign: "center",
    marginVertical: Spacing.md,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  sectionHeaderText: {
    flex: 1,
  },
});
