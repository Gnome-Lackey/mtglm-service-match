module.exports = {
  plugins: ["filenames", "@typescript-eslint"],
  extends: ["@bsokol/eslint-config/node-typescript"],
  rules: {
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/semi": "error",
    "compat/compat": "off",
    "no-catch-shadow": "off"
  }
};
