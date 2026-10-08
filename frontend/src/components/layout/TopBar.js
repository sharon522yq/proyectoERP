import React from "react";
import { View, useWindowDimensions } from "react-native";
import { Text, Button } from "../../design/ui";
import { useAuth } from "../../context/AuthContext";
import { tokens } from "../../theme/tokens";
export default function TopBar({ onToggleMobileMenu, title }) {
  const { user, logout } = useAuth();
  const compact = useWindowDimensions().width < 768;
  return (
    <View
      style={{
        minHeight: 72,
        paddingHorizontal: compact ? 16 : 28,
        paddingVertical: 12,
        gap: 12,
        backgroundColor: tokens.colors.navigation,
        borderBottomWidth: 1,
        borderColor: tokens.colors.border,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {onToggleMobileMenu && (
          <Button
            title="☰"
            variant="secondary"
            accessibilityLabel="Abrir menú de módulos"
            onPress={onToggleMobileMenu}
          />
        )}
        <Text style={{ flex: 1, fontWeight: "600", fontSize: 18 }}>
          {title}
        </Text>
        {!compact && user && (
          <View style={{ maxWidth: "45%", flexShrink: 1 }}>
            <Text style={{ fontWeight: "600", fontSize: 15 }}>{user.name}</Text>
            <Text style={{ fontSize: 13, color: tokens.colors.textMuted }}>
              {user.role}
            </Text>
          </View>
        )}
        <Button title="Salir" variant="secondary" onPress={logout} />
      </View>
      {compact && user && (
        <Text style={{ fontSize: 13, color: tokens.colors.textSecondary }}>
          {user.name} · {user.role}
        </Text>
      )}
    </View>
  );
}
