import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { EasyModeProvider } from "@/components/easy-mode/easy-mode-context";
import { Sidebar } from "@/components/dashboard/sidebar";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { projectId } = await params;

  // プロジェクト一覧取得
  const memberships = await db.projectMember.findMany({
    where: { userId: session.user.id },
    include: {
      project: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const projects = memberships.map((m) => m.project);

  // プロジェクトへのアクセス権確認
  const hasAccess = memberships.some((m) => m.projectId === projectId);
  if (!hasAccess && projects.length > 0) {
    redirect(`/${projects[0].id}/overview`);
  }

  // ユーザーのやさしいモード設定
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { easyMode: true },
  });

  return (
    <EasyModeProvider initialValue={user?.easyMode ?? false}>
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar projects={projects} currentProjectId={projectId} />
        <div className="flex-1 flex flex-col min-w-0">
          {children}
        </div>
      </div>
    </EasyModeProvider>
  );
}
