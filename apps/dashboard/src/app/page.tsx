"use client";

import { DashboardEditor } from "@/components/dashboard-editor";
import { DashboardShell } from "@/components/dashboard-shell";

export default function HomePage() {
  return (
    <DashboardShell>
      <DashboardEditor />
    </DashboardShell>
  );
}
