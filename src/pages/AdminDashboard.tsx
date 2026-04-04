
import React from "react";
import Navbar from "@/components/Navbar";
import AdminDashboard from "@/components/admin/AdminDashboard";
import { Badge } from "@/components/ui/badge";

export default function AdminDashboardPage() {
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-background dark:via-background dark:to-background">
      <Navbar />
      <div className="container mx-auto px-2 sm:px-6 lg:px-8 pb-8 sm:pb-12 pt-28 sm:pt-32 lg:pt-36">
        <div className="flex justify-center mb-4">
           <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full animate-pulse">
              UI System: Synced v2.0
           </Badge>
        </div>
        <AdminDashboard />
      </div>
    </div>
  );
}
