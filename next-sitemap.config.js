/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.NEXT_PUBLIC_APP_URL || "https://pid.vn",
  generateRobotsTxt: true,
  // Don't index the authenticated dashboard / teacher / admin / API areas.
  exclude: [
    "/analytics",
    "/coach",
    "/dna",
    "/input",
    "/quiz/*",
    "/settings",
    "/teacher",
    "/teacher/*",
    "/admin",
    "/admin/*",
    "/api/*",
    "/onboarding",
    "/payment/*",
  ],
  robotsTxtOptions: {
    policies: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/register", "/q"],
        disallow: [
          "/analytics",
          "/coach",
          "/dna",
          "/input",
          "/quiz",
          "/settings",
          "/teacher",
          "/admin",
          "/api",
          "/onboarding",
          "/payment",
        ],
      },
    ],
  },
};
