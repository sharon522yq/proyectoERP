export default [
  {
    files: ["src/**/*.js", "App.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: Object.fromEntries(
        [
          "console",
          "setTimeout",
          "clearTimeout",
          "window",
          "document",
          "navigator",
          "URL",
          "URLSearchParams",
          "atob",
          "Blob",
          "fetch",
          "FormData",
          "TextEncoder",
          "AbortController",
          "process",
          "require",
          "localStorage",
          "sessionStorage",
          "alert",
        ].map((name) => [name, "readonly"]),
      ),
    },
    rules: {
      "no-undef": "error",
      "no-dupe-keys": "error",
      "no-unreachable": "error",
    },
  },
];
