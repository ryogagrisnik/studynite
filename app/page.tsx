import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: {
    absolute: "RunePrep | Multiplayer quizzes from your notes",
  },
  description:
    "Turn your notes into multiplayer quizzes. Auto-generate questions and host a live study party with a single link.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "RunePrep | Multiplayer quizzes from your notes",
    description:
      "Turn your notes into multiplayer quizzes. Auto-generate questions and host a live study party with a single link.",
    url: "/",
    type: "website",
    images: [
      {
        url: "/assets/banner.png",
        width: 1200,
        height: 630,
        alt: "RunePrep multiplayer quiz generator",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "RunePrep | Multiplayer quizzes from your notes",
    description:
      "Turn your notes into multiplayer quizzes. Auto-generate questions and host a live study party with a single link.",
    images: ["/assets/banner.png"],
  },
};

export default function Home() {
  redirect("/decks/new");
}
