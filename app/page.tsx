import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function RootPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  // 最初のプロジェクトにリダイレクト
  const membership = await db.projectMember.findFirst({
    where: { userId: session.user.id },
    include: { project: { select: { id: true } } },
    orderBy: { createdAt: "asc" },
  });

  if (membership) {
    redirect(`/${membership.project.id}/overview`);
  }

  redirect("/projects/new");
}
