import { notFound } from "next/navigation";
import { getPublicCase } from "@/lib/public-access";
import { InvestigationWorkspace } from "@/components/investigation-workspace";
export default async function DemoPage({ params }: { params: Promise<{id:string}> }) {
  const { id } = await params;
  const investigation = getPublicCase(id);
  if (!investigation) notFound();
  return <InvestigationWorkspace publicDemoId={investigation.id}/>;
}
