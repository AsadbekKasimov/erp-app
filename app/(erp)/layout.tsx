import AppShell from "@/app/components/AppShell";

export default function ErpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}