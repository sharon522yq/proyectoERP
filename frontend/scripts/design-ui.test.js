const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("@babel/core");
const flatten = (s) =>
  Object.assign(
    {},
    ...(Array.isArray(s) ? s.flat(Infinity) : [s]).filter(Boolean),
  );
function harness(loaded = true, os = "web") {
  let index = 0;
  const slots = [],
    effects = [],
    timers = [];
  const react = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    forwardRef: (f) => f,
    useState: (v) => {
      const n = index++;
      if (!(n in slots)) slots[n] = v;
      return [slots[n], (v) => (slots[n] = v)];
    },
    useRef: (v) => {
      const n = index++;
      if (!(n in slots)) slots[n] = { current: v };
      return slots[n];
    },
    useEffect: (f) => effects.push(f),
  };
  const native = {
    Platform: { OS: os, select: (v) => v[os] || v.default },
    StyleSheet: { create: (x) => x, flatten },
    Text: "Text",
    TextInput: "Input",
    Pressable: "Pressable",
    View: "View",
    ScrollView: "Scroll",
    Modal: "Modal",
    KeyboardAvoidingView: "Keyboard",
    ActivityIndicator: "Loading",
  };
  const doc = {
    activeElement: {
      focus() {
        doc.restored = true;
      },
    },
    addEventListener: (name, f) => {
      doc.listener = f;
    },
    removeEventListener: () => {
      doc.listener = null;
    },
  };
  const cache = {};
  function read(file) {
    if (cache[file]) return cache[file];
    const code = babel.transformSync(fs.readFileSync(file, "utf8"), {
      filename: file,
      configFile: false,
      babelrc: false,
      plugins: [
        "@babel/plugin-transform-modules-commonjs",
        "@babel/plugin-transform-react-jsx",
      ],
    }).code;
    const context = {
      exports: {},
      document: doc,
      setTimeout: (f) => {
        timers.push(f);
        return 1;
      },
      clearTimeout: () => {},
      require: (name) =>
        name === "react"
          ? react
          : name === "react-native"
            ? native
            : name.endsWith("DesignProvider")
              ? { useDesignFonts: () => loaded }
              : read(path.resolve(path.dirname(file), name + ".js")),
    };
    vm.runInNewContext(code, context);
    return (cache[file] = context.exports);
  }
  const ui = read(path.resolve(__dirname, "../src/design/ui.js")),
    colors = read(path.resolve(__dirname, "../src/theme/colors.js")).colors;
  return {
    ui,
    colors,
    slots,
    effects,
    timers,
    doc,
    render: (name, props) => {
      index = 0;
      return ui[name](props);
    },
  };
}
test("font outlines use the requested regular, semibold and bold aliases without synthetic weights", () => {
  const h = harness();
  for (const [weight, family] of [
    ["400", "Regular"],
    ["600", "SemiBold"],
    ["700", "Bold"],
  ]) {
    const style = flatten(
      h.render("Text", { style: { fontWeight: weight } }).props.style,
    );
    assert.equal(style.fontFamily, "SourceSansPro-" + family);
    assert.equal(style.fontWeight, "400");
  }
});
test("failed or loading fonts still render readable content on Android and web", () => {
  for (const os of ["android", "web"]) {
    const h = harness(false, os),
      text = h.render("Text", {
        children: "Contenido",
        style: { fontWeight: "700" },
      });
    assert.equal(flatten(text.props.style).fontWeight, "700");
    assert.equal(text.type, "Text");
  }
});
test("buttons expose busy/disabled states and a visible native press response", () => {
  const h = harness(true, "android"),
    button = h.render("Button", { title: "Guardar", loading: true });
  assert.equal(button.props.disabled, true);
  assert.equal(button.props.accessibilityState.busy, true);
  const resting = flatten(button.props.style({ pressed: false })),
    pressed = flatten(button.props.style({ pressed: true }));
  assert.notEqual(pressed.backgroundColor, resting.backgroundColor);
  assert.equal(pressed.borderBottomWidth, 1);
  assert.ok(pressed.minHeight >= 48);
});
test("focus preserves the input callback and increases the visible border", () => {
  const h = harness();
  let count = 0;
  h.render("TextInput", { onFocus: () => count++ }).props.onFocus({});
  const input = h.render("TextInput", { onFocus: () => count++ });
  assert.equal(count, 1);
  assert.equal(flatten(input.props.style).borderWidth, 2);
  assert.equal(flatten(input.props.style).borderColor, h.colors.focus);
});
test("modal traps keyboard focus, closes with Escape and restores the triggering control", () => {
  const h = harness();
  let closed = 0;
  h.render("Modal", { visible: true, onRequestClose: () => closed++ });
  const controls = [0, 1].map((n) => ({
    getClientRects: () => [1],
    getAttribute: () => null,
    focus() {
      h.doc.activeElement = this;
    },
  }));
  h.slots[1].current = {
    querySelector: () => controls[0],
    querySelectorAll: () => controls,
  };
  const clean = h.effects[0]();
  h.timers[0]();
  assert.equal(h.doc.activeElement, controls[0]);
  h.doc.listener({ key: "Tab", shiftKey: true, preventDefault() {} });
  assert.equal(h.doc.activeElement, controls[1]);
  h.doc.listener({ key: "Tab", shiftKey: false, preventDefault() {} });
  assert.equal(h.doc.activeElement, controls[0]);
  h.doc.listener({ key: "Escape", preventDefault() {} });
  assert.equal(closed, 1);
  clean();
  assert.equal(h.doc.restored, true);
});
function luminance(hex) {
  const rgb = hex
    .slice(1)
    .match(/../g)
    .map((v) => parseInt(v, 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(a, b) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
test("normal text, status labels and primary button states meet AA contrast", () => {
  const c = harness().colors;
  for (const [fg, bg] of [
    [c.text, c.surface],
    [c.textSecondary, c.surface],
    [c.textMuted, c.surfaceVariant],
    [c.onPrimary, c.primary],
    [c.onPrimary, c.primaryHover],
    [c.onPrimary, c.primaryPressed],
    [c.error, c.errorLight],
    [c.success, c.successLight],
    [c.warning, c.warningLight],
    [c.info, c.infoLight],
  ])
    assert.ok(
      contrast(fg, bg) >= 4.5,
      fg + " on " + bg + " ratio " + contrast(fg, bg),
    );
  assert.ok(contrast("#7686A5", c.surfaceVariant) >= 3);
});

test("nested Android back handler reads current screen state and cleans up its registration", () => {
  const registry = { current: null };
  let index = 0;
  const refs = [],
    effects = [];
  const react = {
    createContext: () => registry,
    useContext: () => registry,
    useRef: (v) => {
      const n = index++;
      return refs[n] || (refs[n] = { current: v });
    },
    useEffect: (f) => effects.push(f),
  };
  const filename = path.resolve(__dirname, "../src/design/NavigationBack.js");
  const code = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename,
    configFile: false,
    babelrc: false,
    plugins: ["@babel/plugin-transform-modules-commonjs"],
  }).code;
  const context = { exports: {}, require: () => react };
  vm.runInNewContext(code, context);
  context.exports.useBackAction(() => true);
  const clean = effects[0]();
  assert.equal(registry.current(), true);
  index = 0;
  context.exports.useBackAction(() => false);
  assert.equal(registry.current(), false);
  clean();
  assert.equal(registry.current, null);
});
