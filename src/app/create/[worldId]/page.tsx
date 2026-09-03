import { CreatorStudio } from "@/components/creator/creator-studio";

export default async function CreatorStudioPage({
  params,
}: {
  params: Promise<{ worldId: string }>;
}) {
  const { worldId } = await params;
  return <CreatorStudio worldId={worldId} />;
}
