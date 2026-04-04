import { Brain, Sparkles, Wand2, ShieldCheck, Microscope } from "lucide-react";

const AIContentDetection = () => {
  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-20 text-center min-h-[500px] bg-gradient-to-br from-violet-50/30 via-white to-indigo-50/30 dark:from-violet-900/10 dark:via-background dark:to-indigo-900/10 rounded-[3rem] border border-primary/5 shadow-inner">
      <div className="relative group mb-10">
        <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full group-hover:bg-primary/30 transition-all duration-700 animate-pulse" />
        <div className="relative bg-white dark:bg-card p-8 rounded-[2.5rem] shadow-2xl border border-primary/10 transition-transform duration-500 group-hover:scale-110">
          <Brain className="h-16 w-16 sm:h-20 sm:w-20 text-primary" />
          <div className="absolute -top-2 -right-2 bg-indigo-500 text-white p-2 rounded-full shadow-lg">
            <Sparkles className="h-4 w-4 animate-spin-slow" />
          </div>
        </div>
      </div>
      
      <div className="max-w-2xl space-y-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-black uppercase tracking-widest border border-primary/5 mb-2">
          New Feature Coming Soon
        </div>
        <h2 className="text-3xl sm:text-5xl font-black tracking-tighter text-foreground leading-[1.1]">
          AI Content <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-indigo-600">Verification</span>
        </h2>
        <p className="text-sm sm:text-lg text-muted-foreground/70 font-medium leading-relaxed max-w-lg mx-auto">
          We're training advanced neural models to protect the Artswarit community by ensuring all platform content is human-created.
        </p>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12 py-8 border-y border-primary/5">
          <div className="flex flex-col items-center gap-3">
            <div className="p-3 rounded-2xl bg-violet-100/50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <p className="text-xs font-black uppercase tracking-widest">Artist Protection</p>
          </div>
          <div className="flex flex-col items-center gap-3">
            <div className="p-3 rounded-2xl bg-indigo-100/50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
              <Wand2 className="h-6 w-6" />
            </div>
            <p className="text-xs font-black uppercase tracking-widest">Model Analysis</p>
          </div>
          <div className="flex flex-col items-center gap-3">
            <div className="p-3 rounded-2xl bg-blue-100/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
              <Microscope className="h-6 w-6" />
            </div>
            <p className="text-xs font-black uppercase tracking-widest">Deep Scan</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIContentDetection;
