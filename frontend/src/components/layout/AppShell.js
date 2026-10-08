import React, { useEffect, useState, useRef } from "react";
import {
  View,
  useWindowDimensions,
  BackHandler,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { Modal, ScrollView, Button } from "../../design/ui";
import { useAuth } from "../../context/AuthContext";
import { MENU_BY_PERMISSION } from "../../constants/config";
import { tokens } from "../../theme/tokens";
import Sidebar from "./Sidebar";
import { BackActionContext } from "../../design/NavigationBack";
import TopBar from "./TopBar";
export default function AppShell({
  currentRoute,
  onSelectRoute,
  children,
  visibleRoutes,
}) {
  const { has } = useAuth();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === "web" && width >= 1024;
  const [open, setOpen] = useState(false);
  const backAction = useRef(null);
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (open) {
          setOpen(false);
          return true;
        }
        if (backAction.current?.()) return true;
        if (currentRoute !== "dashboard") {
          onSelectRoute("dashboard");
          return true;
        }
        return false;
      },
    );
    return () => subscription.remove();
  }, [open, currentRoute, onSelectRoute]);
  return (
    <BackActionContext.Provider value={backAction}>
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          backgroundColor: tokens.colors.background,
        }}
      >
        {desktop && (
          <View style={{ width: 256 }}>
            <Sidebar
              currentRoute={currentRoute}
              onSelectRoute={onSelectRoute}
              hasPermission={has}
              visibleRoutes={visibleRoutes}
            />
          </View>
        )}
        {!desktop && (
          <Modal
            visible={open}
            transparent
            animationType="fade"
            onRequestClose={() => setOpen(false)}
          >
            <View
              style={{
                flex: 1,
                backgroundColor: "rgba(7,12,25,0.72)",
                flexDirection: "row",
              }}
            >
              <View
                style={{
                  width: Math.min(296, width - 48),
                  backgroundColor: tokens.colors.navigation,
                }}
              >
                <View style={{ padding: 12 }}>
                  <Button title="Cerrar menú" onPress={() => setOpen(false)} />
                </View>
                <Sidebar
                  currentRoute={currentRoute}
                  onSelectRoute={(route) => {
                    onSelectRoute(route);
                    setOpen(false);
                  }}
                  hasPermission={has}
                  visibleRoutes={visibleRoutes}
                />
              </View>
              <View style={{ flex: 1 }} />
            </View>
          </Modal>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <TopBar
            onToggleMobileMenu={!desktop ? () => setOpen(true) : null}
            title={
              MENU_BY_PERMISSION.find((item) => item.route === currentRoute)
                ?.label || "NexusERP"
            }
          />
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <ScrollView
              contentContainerStyle={{
                flexGrow: 1,
                padding: desktop ? 28 : width >= 768 ? 20 : 8,
              }}
            >
              <View
                style={{
                  flex: 1,
                  minWidth: 0,
                  width: "100%",
                  maxWidth: 1660,
                  alignSelf: "center",
                }}
              >
                {children}
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </View>
    </BackActionContext.Provider>
  );
}
