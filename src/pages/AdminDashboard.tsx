import Navbar from "@/components/Navbar";
import AdminDashboard from "@/components/admin/AdminDashboard";

export default function AdminDashboardPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-3 sm:px-6 lg:px-8 pb-12 pt-24 sm:pt-28 max-w-7xl">
        <AdminDashboard />
      </main>
    </div>
  );
}
