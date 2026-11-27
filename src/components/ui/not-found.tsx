import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContainer } from "@/components/ui/page-container";

/** The not-found page: a narrow `PageContainer`, like the route error and the onboarding card. */
export function NotFound() {
    return (
        <PageContainer width="narrow">
            <Card className="border-border/60">
                <CardHeader>
                    <CardTitle>Not found</CardTitle>
                    <CardDescription>The page you’re looking for doesn’t exist.</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-4">
                    <div className="text-muted-foreground text-sm">
                        Check the URL or go back to the dashboard.
                    </div>
                    <Link to="/">
                        <Button>
                            Go home
                        </Button>
                    </Link>
                </CardContent>
            </Card>
        </PageContainer>
    );
}
