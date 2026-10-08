import React, { createContext, useContext } from "react";
import { View, Text, Platform, StatusBar } from "react-native";
import { useFonts } from "expo-font";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { tokens } from "../theme/tokens";
const FontContext = createContext(false);
export const useDesignFonts = () => useContext(FontContext);
export default function DesignProvider({ children }) {
  const [loaded, error] = useFonts({
    "SourceSansPro-Regular": require("../../assets/fonts/SourceSansPro-Regular.ttf"),
    "SourceSansPro-SemiBold": require("../../assets/fonts/SourceSansPro-SemiBold.ttf"),
    "SourceSansPro-Bold": require("../../assets/fonts/SourceSansPro-Bold.ttf"),
  });
  // Keep the application usable with a system fallback during loading or failure.
  return (
    <FontContext.Provider value={loaded}>
      <SafeAreaProvider>
        <SafeAreaView
          edges={["top", "left", "right", "bottom"]}
          style={{ flex: 1, backgroundColor: tokens.colors.background }}
        >
          <StatusBar barStyle="light-content" />
          {!!error && (
            <View
              accessibilityRole="alert"
              style={{
                padding: 8,
                backgroundColor: tokens.colors.warningLight,
              }}
            >
              <Text style={{ color: tokens.colors.warning }}>
                No se pudo cargar Source Sans Pro. Se está usando la fuente del
                dispositivo.
              </Text>
            </View>
          )}
          <View
            style={{
              flex: 1,
              ...(Platform.OS === "web" ? { minHeight: 0 } : {}),
            }}
          >
            {children}
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </FontContext.Provider>
  );
}
