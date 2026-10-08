import React from "react";
import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Text } from "../../design/ui";
import { tokens } from "../../theme/tokens";
export default function LoginArtwork() {
  return (
    <LinearGradient
      colors={["#18233B", "#242B50", "#1D2440"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.panel}
    >
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.art}
      >
        <LinearGradient
          colors={["#3B6593", "#66569D", "#8C668A"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.wave}
        />
        <View
          style={[styles.line, { top: 40, transform: [{ rotate: "-26deg" }] }]}
        />
        <View
          style={[
            styles.line,
            {
              top: 92,
              borderColor: "#7F6CAB",
              transform: [{ rotate: "-26deg" }],
            },
          ]}
        />
      </View>
      <View style={{ gap: 24, maxWidth: 420 }}>
        <Text
          style={{
            color: tokens.colors.mintAccent,
            fontSize: 15,
            fontWeight: "600",
          }}
        >
          CLARIDAD PARA TU NEGOCIO
        </Text>
        <Text style={{ fontSize: 42, lineHeight: 49, fontWeight: "700" }}>
          Tu operación, en un solo lugar.
        </Text>
        <Text
          style={{
            color: tokens.colors.textSecondary,
            fontSize: 18,
            lineHeight: 28,
          }}
        >
          Conecta ventas, inventario y finanzas. Trabaja con información
          organizada y concéntrate en lo que sigue.
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {["Ventas", "Inventario", "Finanzas"].map((label) => (
            <View
              key={label}
              style={{
                borderRadius: 20,
                borderWidth: 1,
                borderColor: "#526080",
                paddingVertical: 6,
                paddingHorizontal: 14,
              }}
            >
              <Text style={{ fontSize: 14 }}>{label}</Text>
            </View>
          ))}
        </View>
      </View>
      <Text style={{ color: tokens.colors.textMuted, fontSize: 13 }}>
        NexusERP · Un espacio para trabajar con claridad
      </Text>
    </LinearGradient>
  );
}
const styles = StyleSheet.create({
  panel: {
    width: "56%",
    minHeight: 620,
    padding: 48,
    overflow: "hidden",
    justifyContent: "space-between",
    gap: 80,
  },
  art: {
    position: "absolute",
    left: -60,
    right: -80,
    top: 230,
    height: 450,
    opacity: 0.18,
  },
  wave: {
    height: 230,
    width: 700,
    borderRadius: 150,
    transform: [{ rotate: "-26deg" }],
  },
  line: {
    width: 700,
    height: 250,
    position: "absolute",
    borderWidth: 1,
    borderColor: "#88ACEE",
    borderRadius: 150,
  },
});
