import { RemixStudio } from "@/components/studio/remix-studio";

export default async function StudioPage({
  params,
}: {
  params: Promise<{ branchId: string }>;
}) {
  const { branchId } = await params;
  return <RemixStudio branchId={branchId} />;
}
