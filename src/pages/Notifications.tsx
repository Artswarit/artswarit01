import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import NotificationCenter from "@/components/notifications/NotificationCenter";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Link } from "react-router-dom";
import { Home } from "lucide-react";

const Notifications = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      
      <main className="flex-1 pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Breadcrumbs for easier navigation */}
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/" className="flex items-center gap-1">
                    <Home className="h-3.5 w-3.5" />
                    Home
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Notifications</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="bg-card/30 backdrop-blur-md rounded-3xl border border-muted/20 p-6 sm:p-8 shadow-xl">
            <NotificationCenter />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Notifications;
