import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Palette } from 'lucide-react';
import { Link } from 'react-router-dom';

const Commissions = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-24">
        <div className="max-w-lg w-full text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Palette className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
              Public Commissions — Coming Soon
            </h1>
            <p className="text-muted-foreground leading-relaxed">
              A public marketplace for open commission requests is on the way.
              In the meantime, you can already commission artists directly from
              your dashboard or an artist's profile.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button asChild>
              <Link to="/explore-artists">Browse Artists</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/client-dashboard?tab=projects">My Projects</Link>
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Commissions;
