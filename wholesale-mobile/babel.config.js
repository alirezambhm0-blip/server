module.exports = function (api) {
  api.cache(true);

  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "module-resolver",
        {
          root: ["."],
          alias: {
            "@": "./src",
            "@back": ["../wholesale-api/src"],
            "@/assets": "./assets"
          },
          extensions: [
            ".ios.ts",
            ".android.ts",
            ".ts",
            ".tsx",
            ".js",
            ".jsx",
            ".json"
          ]
        }
      ],
      "react-native-reanimated/plugin"
    ]
  };
};
