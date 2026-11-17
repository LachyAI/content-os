import type { MetadataRoute } from "next";

// Makes Content OS installable: Safari "Add to Home Screen" on iPhone, Brave "Install Content OS" on the laptop.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Content OS",
    short_name: "Content OS",
    description: "Lachy's content calendar, captions and saved links",
    start_url: "/calendar",
    display: "standalone",
    background_color: "#111111",
    theme_color: "#111111",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png" },
    ],
  };
}
