import { CalendarDays, CircleCheck, Package, Plus, Truck, TriangleAlert } from "lucide-react";
import { Link } from "react-router";
import type { EventSummary, Overview as OverviewData } from "../../shared/types";
import { useShell } from "../components/shell";
import { Badge, buttonClass, Callout, Card, CardHeader, cx, EmptyState, Loading, PageHeader, Stat, td, th } from "../components/ui";
import { useApi } from "../lib/api";
import { EVENT_STATUS, formatStart, person, plural } from "../lib/format";
import { useTitle } from "../lib/title";

const ATTENTION_TONE = { missing: "text-danger", needs_cleaning: "text-warning", repair: "text-warning", low_stock: "text-warning" } as const;
const ATTENTION_LABEL = { missing: "Missing", needs_cleaning: "Needs cleaning", repair: "In repair", low_stock: "Low stock" } as const;

export function Overview() {
    useTitle("Overview");
    const { me } = useShell();
    const { data, error } = useApi<OverviewData>("/overview");

    return (
        <>
            <PageHeader
                title={me ? `Hello, ${person(me.email)}` : "Overview"}
                description="What's planned, what's out, and what needs a look."
                actions={
                    <Link to="/events?new=1" className={buttonClass("primary")}>
                        <Plus className="size-4" /> Create event
                    </Link>
                }
            />
            {error && <Callout tone="danger">{error}</Callout>}
            {!data && !error && <Loading />}
            {data && (
                <>
                    <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                        <Stat label="Planned events" value={data.planned} icon={CalendarDays} to="/events?filter=planned" />
                        <Stat label="Events out" value={data.out} icon={Truck} to="/events?filter=out" />
                        <Stat label="Equipment out" value={data.equipment_out} icon={Package} to="/inventory?tab=equipment&status=out" />
                        <Stat label="Needs attention" value={data.attention.length} icon={TriangleAlert} />
                    </div>
                    <div className="grid gap-6 lg:grid-cols-3">
                        <div className="space-y-6 lg:col-span-2">
                            {data.out_events.length > 0 && <EventTable title="Out now" events={data.out_events} />}
                            <EventTable title="Coming up" events={data.upcoming} empty />
                        </div>
                        <Card>
                            <CardHeader title="Needs attention" />
                            <div className="px-3 py-3">
                                {data.attention.length === 0 ? (
                                    <p className="flex items-center gap-2.5 px-2 py-1.5 text-[13px] text-muted">
                                        <CircleCheck className="size-4 text-success" /> Everything is clean, stocked and accounted for.
                                    </p>
                                ) : (
                                    <ul className="space-y-0.5">
                                        {data.attention.map((a, i) => (
                                            <li key={i}>
                                                <Link to={a.href} className="flex items-start gap-2.5 rounded-md px-2 py-1.5 text-[13px] hover:bg-subtle">
                                                    <TriangleAlert className={cx("mt-px size-4 shrink-0", ATTENTION_TONE[a.kind])} />
                                                    <span className="min-w-0">
                                                        <span className="block">{a.label}</span>
                                                        <span className="block text-xs text-muted">{ATTENTION_LABEL[a.kind]}</span>
                                                    </span>
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </Card>
                    </div>
                </>
            )}
        </>
    );
}

function EventTable({ title, events, empty }: { title: string; events: EventSummary[]; empty?: boolean }) {
    return (
        <Card>
            <CardHeader title={title} actions={<Link to="/events" className="text-[13px] text-link hover:underline">All events</Link>} />
            {events.length === 0 && empty ? (
                <EmptyState icon={CalendarDays} title="Nothing planned">
                    Create an event to get its packing list.
                </EmptyState>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-sm">
                        <thead>
                            <tr>
                                <th className={th}>Event</th>
                                <th className={th}>When</th>
                                <th className={cx(th, "text-right")}>Attendees</th>
                            </tr>
                        </thead>
                        <tbody>
                            {events.map((e) => (
                                <tr key={e.id} className="transition-colors hover:bg-hover">
                                    <td className={td}>
                                        <Link to={`/events/${e.id}`} className="group block">
                                            <span className="font-medium text-link group-hover:underline">{e.name}</span>
                                            <span className="block text-xs text-muted">{e.location ?? e.template_name ?? person(e.instructor)}</span>
                                        </Link>
                                    </td>
                                    <td className={cx(td, "text-muted")}>
                                        <div className="flex flex-wrap items-center gap-2">
                                            {formatStart(e.starts_at)}
                                            {e.status !== "planned" && <Badge tone={EVENT_STATUS[e.status].tone} dot>{EVENT_STATUS[e.status].label}</Badge>}
                                        </div>
                                    </td>
                                    <td className={cx(td, "text-right text-muted")}>{plural(e.attendees, "person", "people")}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </Card>
    );
}
