import type { Metadata, ResolvingMetadata } from "next";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

type Props = {
  params: { gameId: string };
};

// Generate dynamic metadata for SEO
export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const gameId = params.gameId;

  try {
    // Fetch game data for metadata
    const res = await fetch(`${API_URL}/api/games/${gameId}/meta`, {
      next: { revalidate: 60 }, // Cache for 60 seconds
    });

    if (!res.ok) {
      return {
        title: "Play Game | HYPD Games",
        description: "Play instant browser games on HYPD Games",
      };
    }

    const game = await res.json();

    return {
      title: `${game.title} | HYPD Games`,
      description: game.description || `Play ${game.title} instantly on HYPD Games`,
      openGraph: {
        title: `${game.title} | HYPD Games`,
        description: game.description || `Play ${game.title} instantly`,
        type: "website",
        siteName: "HYPD Games",
        images: game.thumbnail_url
          ? [
              {
                url: game.thumbnail_url,
                width: 800,
                height: 600,
                alt: game.title,
              },
            ]
          : [],
      },
      twitter: {
        card: "summary_large_image",
        title: `${game.title} | HYPD Games`,
        description: game.description || `Play ${game.title} instantly`,
        images: game.thumbnail_url ? [game.thumbnail_url] : [],
      },
      robots: {
        index: true,
        follow: true,
      },
    };
  } catch {
    return {
      title: "Play Game | HYPD Games",
      description: "Play instant browser games on HYPD Games",
    };
  }
}

export { default } from "./game-player";
