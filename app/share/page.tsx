import type { Metadata } from "next";
import { PublicHomeSharePage } from "@/components/public-home-share-page";

export const metadata: Metadata = {
  title: "Shared home · MyLinker",
  description: "A read-only MyLinker home snapshot.",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nocache: true
  }
};

export default function SharePage() {
  return <PublicHomeSharePage />;
}
