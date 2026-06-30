import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { FolderHeart } from 'lucide-react';
import { Link } from 'react-router-dom';

const Collections = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-24">
        <div className="max-w-lg w-full text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <FolderHeart className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
              Collections — Coming Soon
            </h1>
            <p className="text-muted-foreground leading-relaxed">
              We're building curated collections so you can group, save, and share
              your favourite artworks and artists on Artswarit. Check back soon.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button asChild>
              <Link to="/explore">Explore Artworks</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/explore-artists">Discover Artists</Link>
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Collections;
