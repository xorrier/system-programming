import DefaultTheme from "vitepress/theme";
import CppPlayground from "../components/CppPlayground.vue";
import type { Theme } from "vitepress";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("CppPlayground", CppPlayground);
  },
} satisfies Theme;
