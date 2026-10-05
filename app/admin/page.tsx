import Admin from "./admin";
import { connection } from "next/server";
import { sharingMetadata, siteOrigin } from "../../lib/metadata";
export async function generateMetadata() {
  await connection();
  return sharingMetadata(siteOrigin(), "admin");
}
export default function AdminPage() { return <Admin/>; }
