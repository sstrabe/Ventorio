import { Nfc, Printer, QrCode, SkipForward, Square } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { renderSVG } from "uqr";
import { tagPath } from "../../shared/codes";
import type { Item, ItemType } from "../../shared/types";
import { Button, Callout, Card, CardBody, CardHeader, Checkbox, EmptyState, Field, inputClass, Loading, PageHeader } from "../components/ui";
import { useApi } from "../lib/api";
import { itemLabel, plural } from "../lib/format";
import { useTitle } from "../lib/title";
import { feedback } from "../scanner/feedback";
import { nfcSupported, writeTag } from "../scanner/nfc";

export function Labels() {
    useTitle("Labels");
    const [params, setParams] = useSearchParams();
    const codes = params.get("codes");
    const typeId = params.get("type_id");
    const types = useApi<ItemType[]>("/types");
    const items = useApi<Item[]>(codes ? `/items?codes=${codes}` : typeId ? `/items?type_id=${typeId}` : null);
    const selected = codes || typeId ? items.data : undefined;

    return (
        <>
            <div className="print:hidden">
                <PageHeader
                    title="Labels"
                    description="Each label carries a link to its item: scan it with the camera, or write it onto an NFC tag."
                    actions={
                        selected?.length ? (
                            <Button variant="primary" icon={Printer} onClick={() => window.print()}>
                                Print {plural(selected.length, "label")}
                            </Button>
                        ) : undefined
                    }
                />
                <div className="mb-6 grid gap-6 lg:grid-cols-2">
                    <Card>
                        <CardHeader title="Which labels" />
                        <CardBody>
                            <Field label="Equipment type" htmlFor="label-type">
                                <select
                                    id="label-type"
                                    value={codes ? "" : (typeId ?? "")}
                                    onChange={(e) => setParams(e.target.value ? { type_id: e.target.value } : {}, { replace: true })}
                                    className={inputClass}
                                >
                                    <option value="">{codes ? `${plural(codes.split(",").length, "chosen item")}` : "Choose a type"}</option>
                                    {types.data
                                        ?.filter((t) => t.kind === "equipment")
                                        .map((t) => (
                                            <option key={t.id} value={t.id}>
                                                {t.name} ({t.total})
                                            </option>
                                        ))}
                                </select>
                            </Field>
                        </CardBody>
                    </Card>
                    {selected && selected.length > 0 && <WriteTags items={selected} />}
                </div>
                {items.error && <Callout tone="danger">{items.error}</Callout>}
                {(codes || typeId) && !items.data && !items.error && <Loading />}
                {!codes && !typeId && (
                    <Card>
                        <EmptyState icon={QrCode} title="Choose what to label">
                            Pick a type above, or open labels from an item or from the equipment list.
                        </EmptyState>
                    </Card>
                )}
                {selected?.length === 0 && (
                    <Card>
                        <EmptyState icon={QrCode} title="No equipment to label" />
                    </Card>
                )}
            </div>
            {selected && selected.length > 0 && <Sheet items={selected} />}
        </>
    );
}

/** The labels themselves, sized to cut out (or for 63.5 × 38.1 mm sticker sheets). */
function Sheet({ items }: { items: Item[] }) {
    const origin = window.location.origin;
    const svgs = useMemo(() => new Map(items.map((i) => [i.code, renderSVG(`${origin}${tagPath(i.code)}`, { border: 1 })])), [items, origin]);
    return (
        <div className="grid grid-cols-[repeat(auto-fill,63.5mm)] justify-center gap-2 print:grid-cols-[repeat(3,63.5mm)] print:gap-0">
            {items.map((item) => (
                <div
                    key={item.code}
                    className="flex h-[38.1mm] w-[63.5mm] items-center gap-2 overflow-hidden rounded-md border border-line bg-white p-2 text-black break-inside-avoid print:rounded-none print:border-dashed"
                >
                    <div className="h-full shrink-0 [&_svg]:h-full [&_svg]:w-auto" dangerouslySetInnerHTML={{ __html: svgs.get(item.code)! }} />
                    <div className="min-w-0 leading-tight">
                        <div className="line-clamp-2 text-[11pt] font-semibold">{item.name ?? item.type_name}</div>
                        {item.name && <div className="truncate text-[8pt]">{item.type_name}</div>}
                        <div className="mt-1 font-mono text-[13pt] font-semibold tracking-wider">{item.code}</div>
                        <div className="truncate text-[7pt]">{window.location.host}</div>
                    </div>
                </div>
            ))}
        </div>
    );
}

type WriteState = { step: "idle" } | { step: "waiting"; index: number; locking: boolean } | { step: "done"; written: number };

/** Write each label's link onto NFC tags, one tag after the other (Chrome on Android). */
function WriteTags({ items }: { items: Item[] }) {
    const [state, setState] = useState<WriteState>({ step: "idle" });
    const [lock, setLock] = useState(false);
    const [error, setError] = useState<string>();
    const abort = useRef<AbortController | null>(null);
    const written = useRef(0);

    async function writeFrom(index: number) {
        if (index >= items.length) {
            setState({ step: "done", written: written.current });
            return;
        }
        abort.current?.abort();
        const controller = new AbortController();
        abort.current = controller;
        setState({ step: "waiting", index, locking: false });
        try {
            await writeTag(`${window.location.origin}${tagPath(items[index].code)}`, lock, controller.signal, () =>
                setState({ step: "waiting", index, locking: true })
            );
            written.current += 1;
            setError(undefined);
            feedback("success");
            await writeFrom(index + 1);
        } catch (e) {
            if (controller.signal.aborted) return;
            feedback("danger");
            setError((e as Error).message);
            setState({ step: "waiting", index, locking: false });
        }
    }

    function stop() {
        abort.current?.abort();
        setState({ step: "idle" });
    }

    if (!nfcSupported) {
        return (
            <Card>
                <CardHeader title="NFC tags" />
                <CardBody>
                    <p className="text-[13px] text-muted">To write NFC tags, open this page in Chrome on Android.</p>
                </CardBody>
            </Card>
        );
    }

    const current = state.step === "waiting" ? items[state.index] : null;
    return (
        <Card>
            <CardHeader title="NFC tags" description="Writes each label's link onto a tag; tapping the tag opens the item." />
            <CardBody className="space-y-3">
                {error && <Callout tone="danger">{error}</Callout>}
                {state.step === "idle" && (
                    <>
                        <Checkbox label="Lock each tag" description="Permanent: a locked tag can't be rewritten. Takes a second tap." checked={lock} onChange={setLock} />
                        <Button
                            variant="secondary"
                            icon={Nfc}
                            onClick={() => {
                                written.current = 0;
                                writeFrom(0);
                            }}
                        >
                            Write {plural(items.length, "tag")}
                        </Button>
                    </>
                )}
                {current && state.step === "waiting" && (
                    <>
                        <div className="rounded-md border border-line bg-subtle px-3.5 py-3">
                            <div className="text-xs text-muted">
                                Tag {state.index + 1} of {items.length}
                            </div>
                            <div className="mt-0.5 font-medium">{itemLabel(current)}</div>
                            <div className="mt-1 text-[13px] text-muted">
                                {state.locking ? "Written. Hold the same tag again to lock it." : "Hold a blank tag to the back of the phone."}
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button icon={SkipForward} onClick={() => writeFrom(state.index + 1)}>
                                Skip
                            </Button>
                            <Button variant="ghost" icon={Square} onClick={stop}>
                                Stop
                            </Button>
                        </div>
                    </>
                )}
                {state.step === "done" && (
                    <Callout tone="success" action={<Button size="sm" onClick={() => setState({ step: "idle" })}>Done</Button>}>
                        {plural(state.written, "tag")} written.
                    </Callout>
                )}
            </CardBody>
        </Card>
    );
}
