"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <Skeleton className="h-32 w-full rounded-2xl bg-slate-900/60" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="bg-slate-900/40 border-slate-900">
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24 bg-slate-800/60" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-7 w-20 bg-slate-800/60" />
              <Skeleton className="h-3 w-32 bg-slate-800/60" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="bg-slate-900/40 border-slate-900">
        <CardHeader>
          <Skeleton className="h-5 w-48 bg-slate-800/60" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-3/4 bg-slate-800/60" />
              <Skeleton className="h-2 w-full bg-slate-800/60" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
