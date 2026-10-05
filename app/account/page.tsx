import { connection } from "next/server";
import { sharingMetadata, siteOrigin } from "../../lib/metadata";
import Account from "./account";
export async function generateMetadata() {
  await connection();
  return sharingMetadata(siteOrigin(), "account");
}
export default function AccountPage() { return <Account/>; }
