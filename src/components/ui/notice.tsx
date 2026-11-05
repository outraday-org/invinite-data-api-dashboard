import type * as React from "react";

import { Badge } from "./badge";
import { Card, CardContent, CardHeader, CardTitle } from "./card";

/** A muted, non-error card: an expected state ("not enabled", "not available", "coming soon", a readiness state). */
export function Notice({ badge, children, title }: { badge?: string; children?: React.ReactNode; title: string }) {
    return (
        <Card className="border-muted-foreground/20" role="status" size="sm">
            <CardHeader className="gap-2">
                <div className="flex items-center gap-2">
                    {badge && <Badge variant="outline">{badge}</Badge>}
                    <CardTitle className="text-sm">{title}</CardTitle>
                </div>
            </CardHeader>
            {children && <CardContent className="text-muted-foreground">{children}</CardContent>}
        </Card>
    );
}
