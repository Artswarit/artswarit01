import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Image as ImageIcon, Eye, Heart, Flag } from "lucide-react";
import LogoLoader from "@/components/ui/LogoLoader";
import { useContentKpis, useTopArtworks } from "./hooks/useAdminMetrics";

export default function AdminContent() {
  const { data: kpis, isLoading } = useContentKpis();
  const { data: topViewed, isLoading: tvl } = useTopArtworks("views_count");
  const { data: topLiked } = useTopArtworks("likes_count");

  if (isLoading || !kpis) return <div className="h-64 flex items-center justify-center"><LogoLoader text="Loading content..." /></div>;

  const cards = [
    { label: "Uploads Today", value: kpis.uploadsToday, icon: ImageIcon, color: "text-blue-600", bg: "bg-blue-500/10" },
    { label: "Pending Review", value: kpis.pendingReview, icon: Eye, color: "text-amber-600", bg: "bg-amber-500/10" },
    { label: "Reported", value: kpis.reported, icon: Flag, color: "text-red-600", bg: "bg-red-500/10" },
  ];

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {cards.map((c) => (
          <Card key={c.label} className="border shadow-none sm:shadow-sm rounded-2xl sm:rounded-3xl bg-card">
            <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-6 pb-1 sm:pb-2">
              <CardTitle className="text-[9px] sm:text-xs font-black uppercase tracking-widest text-muted-foreground">{c.label}</CardTitle>
              <div className={`p-1.5 sm:p-2 rounded-lg ${c.bg}`}><c.icon className={`h-3 w-3 sm:h-4 sm:w-4 ${c.color}`} /></div>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0"><div className="text-lg sm:text-2xl font-black">{c.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {[
          { title: "Most Viewed Artworks", icon: Eye, data: topViewed, loading: tvl, metric: "views" },
          { title: "Most Liked Artworks", icon: Heart, data: topLiked, loading: false, metric: "likes" },
        ].map((c) => (
          <Card key={c.title} className="rounded-3xl sm:rounded-[2rem] border shadow-sm overflow-hidden">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                <c.icon className="h-4 w-4 text-primary" /> {c.title}
              </CardTitle>
              <CardDescription className="text-[10px] sm:text-sm">Top 10 by {c.metric}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {c.loading ? <div className="p-6"><LogoLoader /></div> : !c.data?.length ? (
                <p className="p-6 text-sm text-muted-foreground text-center">No data</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Artwork</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">{c.metric}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {c.data.map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell className="text-xs font-medium max-w-[200px] truncate">{a.title}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{a.status}</Badge></TableCell>
                        <TableCell className="text-right text-xs font-bold">{a.metricValue.toLocaleString()}</TableCell>
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
