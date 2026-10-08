import { SearchX } from "lucide-react";
import { Link } from "react-router";
import { buttonClass, Card, EmptyState } from "../components/ui";
import { useTitle } from "../lib/title";

export function NotFound() {
    useTitle("Not found");
    return (
        <Card>
            <EmptyState
                icon={SearchX}
                title="This page doesn't exist"
                action={
                    <Link to="/" className={buttonClass("primary")}>
                        Go to the overview
                    </Link>
                }
            >
                The link may be old, or the thing it pointed to was deleted.
            </EmptyState>
        </Card>
    );
}
