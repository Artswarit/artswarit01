import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription } from
"@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  Upload,
  X,
  FileText,
  AlertTriangle,
  Check,
  GripVertical,
  Calendar,
  Loader2,
  TrendingUp } from
"lucide-react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult } from
"@hello-pangea/dnd";
import { cn } from "@/lib/utils";

interface MilestoneInput {
  id: string;
  title: string;
  description: string;
  deliverables: string;
  amount: number;
  due_date: string;
}

interface ReferenceFile {
  file: File;
  preview: string;
}

interface CreateProjectFormProps {
  artistId?: string;
  onSuccess?: (projectId: string) => void;
  onCancel?: () => void;
}

type ProjectMilestoneStatus = "WAITING_FUNDS" | "LOCKED";

interface ProjectMilestoneInsert {
  project_id: string;
  title: string;
  description: string | null;
  deliverables: string | null;
  amount: number;
  amount_usd: number;
  exchange_rate: number;
  currency: string;
  due_date: string | null;
  sort_order: number;
  status: ProjectMilestoneStatus;
  created_by: string;
}

export function CreateProjectForm({
  artistId,
  onSuccess,
  onCancel
}: CreateProjectFormProps) {
  const { user } = useAuth();
  const { userCurrency, userCurrencySymbol, exchangeRates } = useCurrency();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);

  // Project fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState<number>(0);
  const [deadline, setDeadline] = useState("");
  const [referenceFiles, setReferenceFiles] = useState<ReferenceFile[]>([]);

  // Milestones
  const [milestones, setMilestones] = useState<MilestoneInput[]>([
  {
    id: crypto.randomUUID(),
    title: "",
    description: "",
    deliverables: "",
    amount: 0,
    due_date: ""
  }]
  );

  // Load draft from localStorage on mount
  useEffect(() => {
    try {
      const draft = localStorage.getItem("create_project_draft");
      if (draft) {
        const parsed = JSON.parse(draft);
        setTitle(parsed.title || "");
        setDescription(parsed.description || "");
        setBudget(parsed.budget || 0);
        setDeadline(parsed.deadline || "");
        if (parsed.milestones && Array.isArray(parsed.milestones)) {
          setMilestones(parsed.milestones);
        }
      }
    } catch (e) {
      console.error("Failed to load project draft", e);
    }
  }, []);

  // Save draft to localStorage on change
  useEffect(() => {
    const draft = {
      title,
      description,
      budget,
      deadline,
      milestones
    };
    localStorage.setItem("create_project_draft", JSON.stringify(draft));
  }, [title, description, budget, deadline, milestones]);

  const totalMilestoneAmount = milestones.reduce(
    (sum, m) => sum + (m.amount || 0),
    0
  );
  const budgetMatches = totalMilestoneAmount === budget;

  const addMilestone = () => {
    setMilestones([
    ...milestones,
    {
      id: crypto.randomUUID(),
      title: "",
      description: "",
      deliverables: "",
      amount: 0,
      due_date: ""
    }]
    );
  };

  const removeMilestone = (index: number) => {
    if (milestones.length > 1) {
      setMilestones(milestones.filter((_, i) => i !== index));
    }
  };

  const updateMilestone = (
  index: number,
  field: keyof MilestoneInput,
  value: string | number) =>
  {
    const updated = [...milestones];
    updated[index] = { ...updated[index], [field]: value };
    setMilestones(updated);
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(milestones);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setMilestones(items);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const newFiles = selectedFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file)
    }));
    setReferenceFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setReferenceFiles((prev) => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    // Prevent default to fix mobile refresh issue
    if (e) {
      e.preventDefault();
      if ("stopPropagation" in e) {
        e.stopPropagation();
      }
    }

    // Validation
    if (!title.trim()) {
      toast.error("Please enter a project title");
      return;
    }

    if (budget <= 0) {
      toast.error("Please enter a valid budget");
      return;
    }

    if (!budgetMatches) {
      toast.error("Milestone amounts must equal the total budget");
      return;
    }

    const emptyMilestones = milestones.filter(
      (m) => !m.title.trim() || m.amount <= 0
    );
    if (emptyMilestones.length > 0) {
      toast.error("All milestones must have a title and amount");
      return;
    }

    const currentRate = exchangeRates[userCurrency] || 1;
    const budgetUSD =
    userCurrency === "USD" ?
    budget :
    Number.parseFloat((budget / currentRate).toFixed(6));

    setSubmitting(true);

    try {
      // 1. Check which columns exist in the projects table to avoid "column does not exist" errors
      const { data: colCheck } = await supabase.
      from("projects").
      select("*").
      limit(1);
      const existingCols =
      colCheck && colCheck.length > 0 ? Object.keys(colCheck[0]) : [];

      const projectInsert: any = {
        title,
        description,
        budget: budgetUSD,
        deadline: deadline || null,
        client_id: user?.id,
        artist_id: artistId || null,
        status: "pending",
        is_locked: false,
        reference_files: []
      };

      // Use the higher precision budget but only insert into columns that actually exist
      if (existingCols.includes("amount_usd"))
      projectInsert.amount_usd = budgetUSD;
      if (existingCols.includes("currency"))
      projectInsert.currency = userCurrency;
      if (existingCols.includes("exchange_rate"))
      projectInsert.exchange_rate = currentRate;

      const { data: project, error: projectError } = await supabase.
      from("projects").
      insert(projectInsert).
      select().
      single();

      if (projectError) throw projectError;

      // 2. Upload reference files using project.id in the path
      const uploadedPublicUrls: string[] = [];
      const fileRecords = [];

      if (referenceFiles.length > 0 && user?.id) {
        for (const { file } of referenceFiles) {
          const timestamp = Date.now();
          const fileName = `${timestamp}-${file.name}`;
          const filePath = `${user.id}/${project.id}/${fileName}`;

          const { error: uploadError } = await supabase.storage.
          from("project-files").
          upload(filePath, file);

          if (uploadError) throw uploadError;

          const {
            data: { publicUrl }
          } = supabase.storage.from("project-files").getPublicUrl(filePath);

          uploadedPublicUrls.push(publicUrl);

          fileRecords.push({
            project_id: project.id,
            uploader_id: user.id,
            storage_path: filePath,
            storage_bucket: "project-files",
            original_name: file.name,
            mime_type: file.type || "application/octet-stream",
            size_bytes: file.size
          });
        }

        // 3. Update project with reference file URLs
        const { error: updateError } = await supabase.
        from("projects").
        update({ reference_files: uploadedPublicUrls }).
        eq("id", project.id);

        if (updateError) throw updateError;

        // 4. Insert records into project_files table for visibility in Files tab
        const { error: filesError } = await supabase.
        from("project_files").
        insert(fileRecords);

        if (filesError) {
          console.error("Error inserting project files records:", filesError);
        }
      }

      // 5. Create milestones
      // Check project_milestones columns too
      const { data: milestoneCheck } = await supabase.
      from("project_milestones").
      select("*").
      limit(1);
      const existingMilestoneCols =
      milestoneCheck && milestoneCheck.length > 0 ?
      Object.keys(milestoneCheck[0]) :
      [];

      const milestonesData = milestones.map((m, index) => {
        const amountUSD =
        userCurrency === "USD" ?
        m.amount :
        Number.parseFloat((m.amount / currentRate).toFixed(8));
        const mInsert: any = {
          project_id: project.id,
          title: m.title,
          description: m.description || null,
          deliverables: m.deliverables || null,
          amount: amountUSD,
          sort_order: index,
          status: index === 0 ? "WAITING_FUNDS" : "LOCKED",
          created_by: user!.id
        };

        if (existingMilestoneCols.includes("amount_usd"))
        mInsert.amount_usd = amountUSD;
        if (existingMilestoneCols.includes("currency"))
        mInsert.currency = userCurrency;
        if (existingMilestoneCols.includes("exchange_rate"))
        mInsert.exchange_rate = currentRate;

        return mInsert;
      });

      const { error: milestonesError } = await supabase.
      from("project_milestones").
      insert(milestonesData as any);

      if (milestonesError) throw milestonesError;

      // Do NOT notify artist yet; wait for explicit client confirmation
      toast.success(
        "Project created. Assign an artist and click Confirm to send."
      );

      // Clear draft
      localStorage.removeItem("create_project_draft");

      onSuccess?.(project.id);
    } catch (error: any) {
      toast.error(error.message || "Failed to create project");
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-none shadow-2xl bg-background/50 backdrop-blur-xl rounded-[2.5rem] overflow-hidden ring-1 ring-black/5">
      <CardHeader className="pb-8 pt-10 px-6 sm:px-10">
        <div className="flex items-center gap-4 mb-2">
          <div className="p-3 rounded-2xl bg-primary/10 text-primary">
            <Plus className="h-6 w-6" />
          </div>
          <CardTitle className="text-3xl font-black tracking-tight">
            Create New Project
          </CardTitle>
        </div>
        <CardDescription className="text-base font-medium text-muted-foreground/80 pl-1">
          Define your project details and break it down into milestones
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-10 px-6 sm:px-10 pb-12">
        {/* Project Details */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-1 bg-primary/20 rounded-full" />
            <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">
              Project Overview
            </h3>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2.5">
              <Label htmlFor="title" className="text-sm font-bold ml-1">
                Project Title *
              </Label>
              <Input
                id="title"
                placeholder="e.g., Logo Design for Company X"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-14 rounded-2xl bg-white/50 border-border/40 focus:ring-primary/20 transition-all text-base" />
              
            </div>

            <div className="space-y-2.5">
              <Label htmlFor="budget" className="text-sm font-bold ml-1">
                Total Budget ({userCurrency === "INR" ? "INR" : "USD"}) *
              </Label>
              <div className="relative group">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold group-focus-within:text-primary transition-colors">
                  {userCurrencySymbol}
                </span>
                <Input
                  id="budget"
                  type="number"
                  min="0"
                  className="pl-10 h-14 rounded-2xl bg-white/50 border-border/40 focus:ring-primary/20 transition-all text-base"
                  placeholder={`e.g., ${userCurrency === "INR" ? "50000" : "1000"}`}
                  value={budget || ""}
                  onChange={(e) => setBudget(Number(e.target.value))} />
                
              </div>
              {userCurrency === "INR" && budget > 0 &&
              <div className="flex items-center gap-2 mt-1.5 ml-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-primary/5 w-fit px-2 py-1 rounded-lg">
                  <TrendingUp className="h-3 w-3" />
                  <span>
                    Est. ${(budget / (exchangeRates["INR"] || 83.5)).toFixed(2)}{" "}
                    USD
                  </span>
                </div>
              }
            </div>
          </div>

          <div className="space-y-2.5">
            <Label htmlFor="description" className="text-sm font-bold ml-1">
              Description
            </Label>
            <Textarea
              id="description"
              placeholder="Describe your project requirements, goals, and expectations..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="rounded-2xl bg-white/50 border-border/40 focus:ring-primary/20 transition-all text-base p-4 resize-none" />
            
          </div>

          <div className="space-y-2.5">
            <Label htmlFor="deadline" className="text-sm font-bold ml-1">
              Project Deadline
            </Label>
            <div className="relative group">
              <Input
                id="deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="h-14 rounded-2xl bg-white/50 border-border/40 focus:ring-primary/20 transition-all text-base appearance-none px-4" />
              
            </div>
          </div>

          {/* Reference Files */}
          <div className="space-y-4">
            <Label className="text-sm font-bold ml-1">
              Reference Files (Optional)
            </Label>
            <div
              className="group border-2 border-dashed rounded-[2rem] p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 relative overflow-hidden"
              onClick={() => fileInputRef.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => {if (e.key === "Enter" || e.key === " ") {e.preventDefault();(() => fileInputRef.current?.click())(e);}}}>
              
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground/60 group-hover:text-primary transition-colors group-hover:scale-110 duration-300" />
              <p className="text-base font-bold text-foreground mb-1">
                Upload reference materials
              </p>
              <p className="text-sm text-muted-foreground">
                Images, PDFs, or documents to help the artist
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
              accept="image/*,.pdf,.doc,.docx,.zip" />
            

            {referenceFiles.length > 0 &&
            <div className="flex flex-wrap gap-3 mt-4">
                {referenceFiles.map((rf, index) =>
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-white/60 backdrop-blur-sm rounded-2xl border border-border/40 group/file hover:shadow-md transition-all">
                
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <FileText className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-bold truncate max-w-[150px]">
                      {rf.file.name}
                    </span>
                    <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
                  onClick={() => removeFile(index)}>
                  
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
              )}
              </div>
            }
          </div>
        </div>

        {/* Milestones */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-1 bg-amber-500/20 rounded-full" />
              <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">
                Milestones
              </h3>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={addMilestone}
              className="h-11 px-4 rounded-xl border-primary/20 text-primary font-bold hover:bg-primary hover:text-white transition-all shadow-sm">
              
              <Plus className="h-4 w-4 mr-2" />
              Add Phase
            </Button>
          </div>

          {/* Budget Validation */}
          {budget > 0 &&
          <Alert
            className={cn(
              "rounded-2xl border-none p-5 transition-all duration-500",
              budgetMatches ?
              "bg-emerald-500/10 text-emerald-700 shadow-[0_0_20px_-5px_rgba(16,185,129,0.1)]" :
              "bg-destructive/10 text-destructive shadow-[0_0_20px_-5px_rgba(239,68,68,0.1)]"
            )}>
            
              <div className="flex items-center gap-4">
                <div
                className={cn(
                  "p-2 rounded-xl",
                  budgetMatches ? "bg-emerald-500/20" : "bg-destructive/20"
                )}>
                
                  {budgetMatches ?
                <Check className="h-5 w-5" /> :

                <AlertTriangle className="h-5 w-5" />
                }
                </div>
                <AlertDescription className="text-sm font-bold">
                  Milestone total: {userCurrencySymbol}
                  {totalMilestoneAmount.toLocaleString()} / Budget:{" "}
                  {userCurrencySymbol}
                  {budget.toLocaleString()}
                  {!budgetMatches &&
                " — Please adjust amounts to match the budget."}
                </AlertDescription>
              </div>
            </Alert>
          }

          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="milestones">
              {(provided) =>
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="space-y-4">
                
                  {milestones.map((milestone, index) =>
                <Draggable
                  key={milestone.id}
                  draggableId={milestone.id}
                  index={index}>
                  
                      {(provided) =>
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className="group border border-border/40 rounded-[2rem] p-6 bg-white/40 backdrop-blur-sm hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 relative overflow-hidden">
                    
                          <div className="absolute top-0 left-0 w-1.5 h-full bg-primary/10 group-hover:bg-primary transition-colors" />

                          <div className="flex flex-col sm:flex-row items-start gap-6">
                            <div
                        {...provided.dragHandleProps}
                        className="hidden sm:flex mt-1 cursor-grab active:cursor-grabbing p-2 rounded-lg bg-muted/30 text-muted-foreground hover:text-primary transition-colors">
                        
                              <GripVertical className="h-5 w-5" />
                            </div>

                            <div className="flex-1 space-y-6 w-full">
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary font-black text-xs">
                                    {index + 1}
                                  </span>
                                  <span className="text-sm font-black uppercase tracking-widest text-muted-foreground">
                                    Milestone Phase
                                  </span>
                                </div>
                                {milestones.length > 1 &&
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-xl hover:bg-destructive/10 hover:text-destructive transition-colors sm:opacity-0 group-hover:opacity-100"
                            onClick={() => removeMilestone(index)}>
                            
                                    <Trash2 className="h-5 w-5" />
                                  </Button>
                          }
                              </div>

                              <div className="grid gap-6 md:grid-cols-2">
                                <div className="space-y-2.5">
                                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">
                                    Title *
                                  </Label>
                                  <Input
                              placeholder="e.g., Initial Concepts"
                              value={milestone.title}
                              onChange={(e) =>
                              updateMilestone(
                                index,
                                "title",
                                e.target.value
                              )
                              }
                              className="h-12 rounded-xl bg-white/50 border-border/40 focus:ring-primary/20 text-base font-medium" />
                            
                                </div>
                                <div className="space-y-2.5">
                                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">
                                    Amount (
                                    {userCurrency === "INR" ? "INR" : "USD"}) *
                                  </Label>
                                  <div className="relative group">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground group-focus-within:text-primary transition-colors">
                                      {userCurrencySymbol}
                                    </span>
                                    <Input
                                type="number"
                                min="0"
                                className="pl-8 h-12 rounded-xl bg-white/50 border-border/40 focus:ring-primary/20 text-base font-bold"
                                placeholder="0"
                                value={milestone.amount || ""}
                                onChange={(e) =>
                                updateMilestone(
                                  index,
                                  "amount",
                                  Number(e.target.value)
                                )
                                } />
                              
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-2.5">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">
                                  Description
                                </Label>
                                <Textarea
                            placeholder="Describe what will be delivered in this milestone..."
                            value={milestone.description}
                            onChange={(e) =>
                            updateMilestone(
                              index,
                              "description",
                              e.target.value
                            )
                            }
                            rows={2}
                            className="rounded-xl bg-white/50 border-border/40 focus:ring-primary/20 text-sm p-4 resize-none" />
                          
                              </div>

                              <div className="grid gap-6 md:grid-cols-2">
                                <div className="space-y-2.5">
                                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">
                                    Deliverables
                                  </Label>
                                  <Input
                              placeholder="e.g., 3 logo concepts"
                              value={milestone.deliverables}
                              onChange={(e) =>
                              updateMilestone(
                                index,
                                "deliverables",
                                e.target.value
                              )
                              }
                              className="h-12 rounded-xl bg-white/50 border-border/40 focus:ring-primary/20 text-sm font-medium" />
                            
                                </div>
                                <div className="space-y-2.5">
                                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">
                                    Due Date
                                  </Label>
                                  <div className="relative">
                                    <Input
                                type="date"
                                value={milestone.due_date}
                                onChange={(e) =>
                                updateMilestone(
                                  index,
                                  "due_date",
                                  e.target.value
                                )
                                }
                                min={
                                new Date().toISOString().split("T")[0]
                                }
                                className="h-12 rounded-xl bg-white/50 border-border/40 focus:ring-primary/20 text-sm appearance-none px-4" />
                              
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                  }
                    </Draggable>
                )}
                  {provided.placeholder}
                </div>
              }
            </Droppable>
          </DragDropContext>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 pt-8 border-t border-border/40">
          {onCancel &&
          <Button
            variant="outline"
            onClick={onCancel}
            className="h-14 sm:h-12 px-8 rounded-2xl font-bold uppercase tracking-widest text-xs border-border/60 hover:bg-muted transition-all">
            
              Cancel
            </Button>
          }
          <Button
            className="flex-1 h-14 sm:h-12 px-4 sm:px-8 rounded-2xl font-black uppercase tracking-wider text-[10px] sm:text-xs shadow-xl shadow-primary/20 hover:shadow-primary/30 transition-all duration-300 active:scale-[0.98]"
            onClick={handleSubmit}
            disabled={
            submitting || !budgetMatches || !title.trim() || budget <= 0
            }>
            
            {submitting ?
            <div className="flex items-center gap-3">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Creating Project...</span>
              </div> :

            "Launch Project Request"
            }
          </Button>
        </div>
      </CardContent>
    </Card>);

}




