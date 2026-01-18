import { MetadataRoute } from "next";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
const SITE_URL = "https://swipegame-4.preview.emergentagent.com"; // Update this for production

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/explore`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/pro`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/profile`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.5,
    },
  ];

  // Dynamic game pages
  let gamePages: MetadataRoute.Sitemap = [];

  try {
    const res = await fetch(`${API_URL}/api/games`, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (res.ok) {
      const games = await res.json();
      gamePages = games.map((game: { id: string; created_at?: string }) => ({
        url: `${SITE_URL}/play/${game.id}`,
        lastModified: game.created_at ? new Date(game.created_at) : new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      }));
    }
  } catch (error) {
    console.error("Error fetching games for sitemap:", error);
  }

  return [...staticPages, ...gamePages];
}
