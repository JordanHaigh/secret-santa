import { Reveal } from "./reveal";
import { connection } from "next/server";
import { sharingMetadata, siteOrigin } from "../../../lib/metadata";
export async function generateMetadata() {
  await connection();
  return sharingMetadata(siteOrigin(), "reveal");
}
export default async function RevealPage({ params }: { params: Promise<{ token: string }> }) {
  return <Reveal token={(await params).token}/>;
}
