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
  const { projectId } = await params;

  const projects = await db.project.findMany({
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <EasyModeProvider>
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar projects={projects} currentProjectId={projectId} />
        <div className="flex-1 flex flex-col min-w-0">
          {children}
        </div>
      </div>
    </EasyModeProvider>
  );
}
