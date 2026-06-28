import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Image as ImageIcon, Eye, Heart, Flag } from "lucide-react";
import LogoLoader from "@/components/ui/LogoLoader";
import KpiCard from "./KpiCard";
import { useContentKpis, useTopArtworks } from "./hooks/useAdminMetrics";

export default function AdminContent() {
  const { data: kpis, isLoading } = useContentKpis();
  const { data: topViewed, isLoading: tvl } = useTopArtworks("views_count");
  const { data: topLiked } = useTopArtworks("likes_count");

  if (isLoading || !kpis) return <div className="h-64 flex items-center justify-center"><LogoLoader text="Loading content..." /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <KpiCard label="Uploads Today" value={kpis.uploadsToday} icon={ImageIcon} />
        <KpiCard label="Unpublished" value={kpis.pendingReview} icon={Eye} delta={kpis.pendingReview > 0 ? { value: "review", tone: "warn" } : undefined} />
        <KpiCard label="Reported" value={kpis.reported} icon={Flag} delta={kpis.reported > 0 ? { value: "moderate", tone: "negative" } : undefined} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        {[
          { title: "Most Viewed", icon: Eye, data: topViewed, loading: tvl, metric: "views" },
          { title: "Most Liked", icon: Heart, data: topLiked, loading: false, metric: "likes" },
        ].map((c) => (
          <Card key={c.title} className="rounded-xl border border-border/60 shadow-none overflow-hidden">
            <CardHeader className="p-5 pb-3 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <c.icon className="h-4 w-4 text-muted-foreground" /> {c.title}
                </CardTitle>
                <p className="text-[11px] text-muted-foreground mt-0.5">Top 10 by {c.metric}</p>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">top 10</span>
            </CardHeader>
            <CardContent className="p-0">
              {c.loading ? <div className="p-6"><LogoLoader /></div> : !c.data?.length ? (
                <p className="p-6 text-xs text-muted-foreground text-center">No data</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[11px]">Artwork</TableHead>
                      <TableHead className="text-[11px]">Status</TableHead>
                      <TableHead className="text-[11px] text-right">{c.metric}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {c.data.map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell className="text-xs font-medium max-w-[200px] truncate">{a.title}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px] font-normal">{a.status}</Badge></TableCell>
                        <TableCell className="text-right text-xs font-mono font-semibold">{a.metricValue.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
