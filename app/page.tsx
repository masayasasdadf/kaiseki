export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export default async function RootPage() {
  const project = await db.project.findFirst({ orderBy: { createdAt: "asc" } });
  if (project) {
    redirect(`/${project.id}/overview`);
  }
  redirect("/projects/new");
}
