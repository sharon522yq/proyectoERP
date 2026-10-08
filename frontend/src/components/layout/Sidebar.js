import React from "react";
import { View, StyleSheet } from "react-native";
import { Text, TouchableOpacity, ScrollView } from "../../design/ui";
import { MENU_BY_PERMISSION } from "../../constants/config";
import { tokens } from "../../theme/tokens";
import AppWordmark from "../branding/AppWordmark";
const groups = {
  dashboard: "Espacio de trabajo",
  crm: "Operaciones",
  products: "Operaciones",
  inventory: "Operaciones",
  sales: "Operaciones",
  purchases: "Operaciones",
  finance: "Gestión",
  hr: "Gestión",
  projects: "Gestión",
  production: "Gestión",
  ai: "Gestión",
  admin: "Administración",
  settings: "Administración",
  audit: "Administración",
};
const initials = {
  dashboard: "IN",
  crm: "CR",
  products: "PR",
  inventory: "AL",
  sales: "VE",
  purchases: "CO",
  finance: "FI",
  hr: "RH",
  projects: "PY",
  production: "PD",
  admin: "US",
  settings: "CF",
  audit: "AU",
  ai: "IA",
};
export default function Sidebar({
  currentRoute,
  onSelectRoute,
  hasPermission,
  onCloseMobile,
  visibleRoutes,
}) {
  const menu = MENU_BY_PERMISSION.filter(
    (m) =>
      (!m.permission || hasPermission(m.permission)) &&
      (!visibleRoutes || visibleRoutes.includes(m.route)),
  );
  return (
    <View style={styles.sidebar}>
      <View style={{ paddingHorizontal: 20, paddingVertical: 20 }}>
        <AppWordmark size={32} />
        <Text
          style={{
            color: tokens.colors.textMuted,
            marginTop: 12,
            fontSize: 13,
          }}
        >
          Tu espacio de operación
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 12,
          paddingBottom: 28,
          gap: 4,
        }}
      >
        {["Espacio de trabajo", "Operaciones", "Gestión", "Administración"].map(
          (group) => (
            <View key={group}>
              {menu.some((m) => groups[m.route] === group) && (
                <Text
                  style={{
                    color: tokens.colors.textMuted,
                    fontSize: 13,
                    padding: 12,
                    fontWeight: "600",
                  }}
                >
                  {group}
                </Text>
              )}
              {menu
                .filter((m) => groups[m.route] === group)
                .map((item) => {
                  const active = currentRoute === item.route;
                  return (
                    <TouchableOpacity
                      key={item.route}
                      accessibilityRole="button"
                      accessibilityLabel={item.label}
                      accessibilityState={{ selected: active }}
                      style={({ pressed, hovered }) => [
                        styles.item,
                        {
                          backgroundColor: active
                            ? tokens.colors.primaryLight
                            : pressed || hovered
                              ? tokens.colors.surfaceHover
                              : "transparent",
                          borderLeftColor: active
                            ? tokens.colors.blueAccent
                            : "transparent",
                        },
                      ]}
                      onPress={() => {
                        onSelectRoute(item.route);
                        onCloseMobile?.();
                      }}
                    >
                      <View accessible={false} style={styles.icon}>
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "600",
                            color: active
                              ? tokens.colors.blueAccent
                              : tokens.colors.textMuted,
                          }}
                        >
                          {initials[item.route]}
                        </Text>
                      </View>
                      <Text
                        style={{
                          flex: 1,
                          fontSize: 15,
                          fontWeight: active ? "600" : "400",
                          color: active
                            ? tokens.colors.text
                            : tokens.colors.textSecondary,
                        }}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
            </View>
          ),
        )}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  sidebar: {
    width: 256,
    maxWidth: "100%",
    flexShrink: 0,
    flex: 1,
    minHeight: 0,
    backgroundColor: tokens.colors.navigation,
    borderRightWidth: 1,
    borderColor: tokens.colors.border,
  },
  item: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 11,
    borderLeftWidth: 3,
    marginVertical: 2,
    minHeight: 48,
  },
  icon: {
    width: 28,
    height: 28,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
