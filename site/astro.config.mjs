import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  integrations: [
    starlight({
      title: "Solidion",
      description: "SolidJS custom renderer for Phaser 3",
      defaultLocale: "root",
      locales: {
        root: {
          label: "English",
          lang: "en",
        },
        ja: {
          label: "日本語",
        },
      },
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/penta2himajin/solidion",
        },
      ],
      sidebar: [
        {
          label: "Getting Started",
          translations: { ja: "はじめに" },
          items: [
            { slug: "getting-started/introduction" },
            { slug: "getting-started/installation" },
            { slug: "getting-started/quick-start" },
          ],
        },
        {
          label: "Guides",
          translations: { ja: "ガイド" },
          items: [
            { slug: "guides/components" },
            { slug: "guides/hooks" },
            { slug: "guides/behaviors" },
            { slug: "guides/recs" },
          ],
        },
        {
          label: "Examples",
          translations: { ja: "デモ" },
          items: [
            { slug: "examples/breakout" },
            { slug: "examples/aquarium" },
            { slug: "examples/floppy-heads" },
            { slug: "examples/nadion-defense" },
            { slug: "examples/null-pow" },
            { slug: "examples/honeycomb-rush" },
          ],
        },
      ],
      components: {
        Header: "./src/components/overrides/Header.astro",
      },
      customCss: ["./src/styles/custom.css"],
    }),
  ],
});
