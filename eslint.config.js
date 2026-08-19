import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

const globaliBrowser = {
  window: "readonly", document: "readonly", localStorage: "readonly", sessionStorage: "readonly",
  BroadcastChannel: "readonly", console: "readonly", fetch: "readonly",
  setTimeout: "readonly", clearTimeout: "readonly",
  setInterval: "readonly", clearInterval: "readonly",
  btoa: "readonly", atob: "readonly",
};

export default [
  js.configs.recommended,
  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: globaliBrowser,
    },
    plugins: { react, "react-hooks": reactHooks },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      // Il testo di gioco è tutto in prosa italiana, piena di apostrofi:
      // la regola servirebbe solo a rumore, non a prevenire bug.
      "react/no-unescaped-entities": "off",
      "no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      // I catch "silenziosi" sono intenzionali: il polling verso lo storage
      // condiviso deve ignorare un fallimento isolato e riprovare al giro
      // successivo, non interrompere il gioco.
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
    settings: { react: { version: "detect" } },
  },
  {
    files: ["server/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        process: "readonly", console: "readonly",
        setInterval: "readonly", clearInterval: "readonly",
      },
    },
  },
];

