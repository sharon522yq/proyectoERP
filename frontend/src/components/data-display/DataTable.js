import React from "react";
import { View, Platform, useWindowDimensions } from "react-native";
import { Text } from "../../design/ui";
import { tokens } from "../../theme/tokens";
// Desktop comparison table, equivalent labelled cards for narrow screens and Android.
export default function DataTable({
  columns,
  rows,
  keyFor,
  label,
  renderCell,
}) {
  const { width } = useWindowDimensions();
  const wide = Platform.OS === "web" && width >= 1200;
  return (
    <View
      accessibilityRole={wide ? "table" : undefined}
      accessibilityLabel={label}
      style={{
        gap: wide ? 0 : 12,
        borderWidth: wide ? 1 : 0,
        borderColor: tokens.colors.border,
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      {wide && (
        <View
          accessibilityRole="row"
          style={{
            flexDirection: "row",
            backgroundColor: tokens.colors.surfaceElevated,
            padding: 16,
            gap: 16,
          }}
        >
          {columns.map((col) => (
            <Text
              key={col.key}
              accessibilityRole="columnheader"
              style={{
                flex: col.flex || 1,
                fontWeight: "600",
                color: tokens.colors.textSecondary,
                textAlign: col.numeric ? "right" : "left",
              }}
            >
              {col.label}
            </Text>
          ))}
        </View>
      )}
      {rows.map((row) => (
        <View
          key={keyFor(row)}
          accessibilityRole={wide ? "row" : undefined}
          style={{
            flexDirection: wide ? "row" : "column",
            gap: 16,
            padding: 18,
            borderRadius: wide ? 0 : 16,
            borderWidth: wide ? 0 : 1,
            borderBottomWidth: 1,
            borderColor: tokens.colors.border,
            backgroundColor: tokens.colors.surface,
          }}
        >
          {columns.map((col) => (
            <View
              key={col.key}
              accessibilityRole={wide ? "cell" : undefined}
              style={{
                flex: wide ? col.flex || 1 : undefined,
                minWidth: 0,
                alignItems: wide && col.numeric ? "flex-end" : "stretch",
                gap: 6,
              }}
            >
              {!wide && (
                <Text style={{ color: tokens.colors.textMuted, fontSize: 13 }}>
                  {col.label}
                </Text>
              )}
              {renderCell(row, col.key)}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
