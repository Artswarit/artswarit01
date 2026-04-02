import { ReactNode } from "react";
import { CheckCircle2, X } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import LogoWithName from "@/components/LogoWithName";
import { cn } from "@/lib/utils";

interface AuthShellHighlight {
  title: string;
  description: string;
}

interface AuthShellProps {
  title: string;
  description: string;
  highlights: AuthShellHighlight[];
  children: ReactNode;
  isModal?: boolean;
  onClose?: () => void;
}

const AuthShell = ({
  title,
  description,
  highlights,
  children,
  isModal = false,
  onClose,
}: AuthShellProps) => {
  return (
    <div className={cn("min-h-screen flex flex-col bg-background", isModal && "min-h-0")}>
      {!isModal && <Navbar />}

      <main
        className={cn(
          "relative flex-1 overflow-hidden",
          isModal ? "py-6" : "pt-24 pb-16 sm:pt-28 lg:pt-32",
        )}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -right-12 top-1/3 h-80 w-80 rounded-full bg-accent/80 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-secondary/80 blur-3xl" />
        </div>

        {isModal && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-background/90 text-foreground shadow-sm transition-colors hover:bg-accent"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        <div className="container-responsive relative">
          <div className="mx-auto grid max-w-6xl items-center gap-6 lg:grid-cols-[minmax(0,1fr)_30rem] lg:gap-10">
            <section className="hidden rounded-[2rem] border border-border/60 bg-card/65 p-8 shadow-xl backdrop-blur-sm lg:block xl:p-10">
              <div className="max-w-lg space-y-8">
                <LogoWithName />

                <div className="space-y-4 text-left">
                  <div className="inline-flex rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                    Artswarit access
                  </div>
                  <h2 className="max-w-md text-4xl font-heading font-semibold leading-tight tracking-tight text-foreground xl:text-5xl">
                    {title}
                  </h2>
                  <p className="max-w-md text-base leading-7 text-muted-foreground">
                    {description}
                  </p>
                </div>

                <div className="grid gap-4">
                  {highlights.map((highlight) => (
                    <div
                      key={highlight.title}
                      className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/70 p-4"
                    >
                      <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <div className="space-y-1 text-left">
                        <p className="font-medium text-foreground">{highlight.title}</p>
                        <p className="text-sm leading-6 text-muted-foreground">
                          {highlight.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="w-full max-w-[30rem] justify-self-center">
              <div className="mb-6 text-center lg:hidden">
                <LogoWithName />
              </div>
              {children}
            </section>
          </div>
        </div>
      </main>

      {!isModal && <Footer />}
    </div>
  );
};

export default AuthShell;