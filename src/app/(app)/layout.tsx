import AppShell from "@/components/app-shell/AppShell";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
