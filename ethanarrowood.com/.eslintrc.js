/**
 * @type {import('eslint').Linter.Config}
 */
module.exports = {
  extends: ["next", "next/core-web-vitals", "prettier"],
  rules: {
    "@next/next/no-html-link-for-pages": ["off"],
  },
  parserOptions: {
    babelOptions: {
      presets: [require.resolve("next/babel")],
    },
  },
};
