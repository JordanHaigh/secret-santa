import { Reveal } from "./reveal";
export const metadata = { title: "Your recipient — Family Secret Santa", robots: { index: false, follow: false } };
export default async function RevealPage({ params }: { params: Promise<{ token: string }> }) {
  return <Reveal token={(await params).token}/>;
}
