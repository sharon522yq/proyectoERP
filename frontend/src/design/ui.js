import React, { forwardRef, useEffect, useRef, useState } from "react";
import {
  Text as NativeText,
  TextInput as NativeInput,
  View,
  Pressable as NativePressable,
  ScrollView as NativeScroll,
  Modal as NativeModal,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useDesignFonts } from "./DesignProvider";
import { tokens } from "../theme/tokens";
const c = tokens.colors;
function fontStyle(style, loaded) {
  const weight = String(StyleSheet.flatten(style)?.fontWeight || "400");
  const family =
    Number(weight) >= 700
      ? "bold"
      : Number(weight) >= 500
        ? "semibold"
        : "regular";
  return loaded
    ? { fontFamily: tokens.typography.families[family], fontWeight: "400" }
    : {
        fontWeight: weight,
        ...(Platform.OS === "web"
          ? { fontFamily: "system-ui, sans-serif" }
          : {}),
      };
}
export const Text = forwardRef(({ style, ...props }, ref) => (
  <NativeText
    ref={ref}
    {...props}
    style={[
      {
        color: c.text,
        fontSize: 16,
        lineHeight: Math.ceil(
          (StyleSheet.flatten(style)?.fontSize || 16) * 1.45,
        ),
        flexShrink: 1,
      },
      style,
      fontStyle(style, useDesignFonts()),
    ]}
  />
));
export const TextInput = forwardRef(
  ({ style, onFocus, onBlur, ...props }, ref) => {
    const [focused, setFocused] = useState(false);
    const loaded = useDesignFonts();
    return (
      <NativeInput
        ref={ref}
        placeholderTextColor={c.textMuted}
        selectionColor={c.focus}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          {
            color: c.text,
            backgroundColor: c.surfaceVariant,
            minHeight: 48,
            minWidth: 0,
            maxWidth: "100%",
            padding: 12,
            borderRadius: 11,
            borderWidth: 1,
            borderColor: "#7686A5",
            fontSize: 16,
          },
          style,
          { borderColor: focused ? c.focus : "#7686A5" },
          fontStyle(style, loaded),
          focused && { borderColor: c.focus, borderWidth: 2 },
          props.editable === false && { opacity: 0.6 },
        ]}
      />
    );
  },
);
export function Button({
  title,
  onPress,
  disabled,
  color,
  variant,
  loading,
  accessibilityLabel,
  ...props
}) {
  const [focus, setFocus] = useState(false),
    [hover, setHover] = useState(false);
  const tone =
    variant ||
    (color === c.error
      ? "danger"
      : color === c.surfaceHover
        ? "secondary"
        : /^(Cancelar|Volver|Cerrar|Anterior|Siguiente|Actualizar)/.test(title)
          ? "secondary"
          : "primary");
  const bg =
    tone === "danger"
      ? c.errorLight
      : tone === "success"
        ? c.mintAccent
        : tone === "secondary"
          ? c.surfaceElevated
          : c.primary;
  const fg =
    tone === "danger"
      ? c.error
      : tone === "success"
        ? c.background
        : tone === "secondary"
          ? c.text
          : c.onPrimary;
  return (
    <NativePressable
      {...props}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{
        disabled: !!disabled || !!loading,
        busy: !!loading,
      }}
      disabled={disabled || loading}
      onPress={onPress}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={({ pressed }) => [
        {
          minHeight: 48,
          maxWidth: "100%",
          paddingHorizontal: 20,
          paddingVertical: 11,
          borderRadius: 13,
          borderWidth: 1,
          borderTopColor: "#A393DC",
          borderLeftColor: c.border,
          borderRightColor: c.border,
          borderBottomColor: tone === "primary" ? "#493B83" : c.border,
          borderBottomWidth: pressed ? 1 : 3,
          backgroundColor: disabled
            ? c.surfaceHover
            : pressed && tone === "primary"
              ? c.primaryPressed
              : hover && tone === "primary"
                ? c.primaryHover
                : bg,
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 1,
          opacity: disabled ? 0.55 : 1,
          transform: [{ translateY: pressed ? 1 : 0 }],
        },
        tone === "primary" && !pressed && !disabled && tokens.shadows.sm,
        focus && {
          borderColor: c.focus,
          ...(Platform.OS === "web"
            ? {
                outlineColor: c.focus,
                outlineWidth: 2,
                outlineStyle: "solid",
                outlineOffset: 3,
              }
            : {}),
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text
          style={{
            color: fg,
            fontWeight: "600",
            textAlign: "center",
            lineHeight: 21,
          }}
        >
          {title}
        </Text>
      )}
    </NativePressable>
  );
}
export const TouchableOpacity = forwardRef(
  (
    { style, disabled, children, activeOpacity, onFocus, onBlur, ...props },
    ref,
  ) => {
    const [focus, setFocus] = useState(false),
      [hover, setHover] = useState(false);
    return (
      <NativePressable
        ref={ref}
        accessibilityRole="button"
        {...props}
        disabled={disabled}
        onFocus={(e) => {
          setFocus(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocus(false);
          onBlur?.(e);
        }}
        onHoverIn={() => setHover(true)}
        onHoverOut={() => setHover(false)}
        style={({ pressed }) => [
          { minHeight: 44, maxWidth: "100%", justifyContent: "center" },
          typeof style === "function"
            ? style({ pressed, hovered: hover })
            : style,
          pressed && { opacity: 0.8, transform: [{ translateY: 1 }] },
          hover && !disabled && { borderColor: c.focus },
          focus && { borderWidth: 2, borderColor: c.focus },
          disabled && { opacity: 0.55 },
        ]}
      >
        {children}
      </NativePressable>
    );
  },
);
export const Pressable = TouchableOpacity;
export const ScrollView = forwardRef(
  ({ contentContainerStyle, ...props }, ref) => (
    <NativeScroll
      ref={ref}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      {...props}
      contentContainerStyle={contentContainerStyle}
    />
  ),
);
export function Modal({ children, onRequestClose, visible, ...props }) {
  const previousFocus = useRef(null),
    container = useRef(null),
    close = useRef(onRequestClose);
  close.current = onRequestClose;
  useEffect(() => {
    if (Platform.OS !== "web" || !visible) return;
    previousFocus.current = document.activeElement;
    const focus = () =>
      container.current
        ?.querySelector?.('input,button,[tabindex="0"]')
        ?.focus();
    const timer = setTimeout(focus, 100);
    const key = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close.current?.();
      }
      if (event.key !== "Tab") return;
      const controls = [
        ...(container.current?.querySelectorAll?.(
          'input:not(:disabled),button:not(:disabled),[tabindex="0"]',
        ) || []),
      ].filter(
        (el) =>
          el.getClientRects().length &&
          el.getAttribute("aria-disabled") !== "true",
      );
      if (!controls.length) {
        event.preventDefault();
        return;
      }
      const first = controls[0],
        last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", key);
      previousFocus.current?.focus?.();
    };
  }, [visible]);
  return (
    <NativeModal
      {...props}
      animationType="none"
      visible={visible}
      onRequestClose={onRequestClose}
    >
      <KeyboardAvoidingView
        ref={container}
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <NativeScroll
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1 }}
          style={{ flex: 1 }}
        >
          <View style={{ flex: 1, minHeight: "100%" }}>{children}</View>
        </NativeScroll>
      </KeyboardAvoidingView>
    </NativeModal>
  );
}
