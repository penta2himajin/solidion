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
          items: [
            { label: "Introduction", slug: "getting-started/introduction" },
            { label: "Installation", slug: "getting-started/installation" },
            { label: "Quick Start", slug: "getting-started/quick-start" },
          ],
        },
        {
          label: "Guides",
          items: [
            { label: "Components", slug: "guides/components" },
            { label: "Hooks", slug: "guides/hooks" },
            { label: "Behaviors", slug: "guides/behaviors" },
          ],
        },
        {
          label: "Examples",
          items: [
            { label: "Breakout", slug: "examples/breakout" },
            { label: "Aquarium", slug: "examples/aquarium" },
            { label: "Floppy Heads", slug: "examples/floppy-heads" },
            { label: "Nadion Defense", slug: "examples/nadion-defense" },
            { label: "Null Pow", slug: "examples/null-pow" },
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
