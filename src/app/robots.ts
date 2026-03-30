export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api", "/auth", "/account", "/dashboard", "/_next", "/public"],
      },
      {
        userAgent: "AdsBot-Google",
        allow: "/",
      },
    ],
    sitemap: "https://dibble.farm/sitemap.xml",
    host: "https://dibble.farm",
  };
}
