import Modal from "@/app/Modal";
import { useModal } from "@/contexts/modal";
import { Event } from "@/types/database";
import { Radio, RadioGroup } from "@headlessui/react";
import { FormEvent, useState } from "react";
import { Scanner } from "./scanner";
import { DetectedBarcode } from "barcode-detector";

interface EquipmentTag {
    type: string
    serial: string
}

export default function CheckoutModal({ visible }: { visible: boolean }) {
    const [modalData] = useModal();
    const [items, setItems] = useState<EquipmentTag[]>([]);

    const event = modalData.data?.event as Event;
    if (!event) return;

    function onSubmit(e: FormEvent) {
        e.preventDefault();
    }

    function onScan(data: DetectedBarcode[]) {
        if (data.length === 0) return;

        data.forEach((val) => {
            console.log(val)
            handleItem(JSON.parse(val.rawValue))
        })
    };

    async function handleItem(data: EquipmentTag) {
        if (items.filter(val => val.serial === data.serial).length > 0) return;
        if (!event.diff || (event.diff[data.type]?.amount ?? 0) - items.filter(val => val.type === data.type).length < 0) return;

        const newItems = [...items];
        newItems.push(data);
        setItems(newItems);

        const audio = new Audio('/start.mp3');
        if (audio.currentTime > 0) return;
        await audio.play();
    }

    return (
        <Modal visible={visible}>
            <form onSubmit={onSubmit} className="m-10 w-[75vw] sm:w-[50vw] lg:w-[30vw] xl:[10vw] text-white rounded-lg p-8 bg-transparent border-solid border-2 border-[rgba(255,255,255,.2)] backdrop-blur-3xl shadow-xl max-h-[75vh] overflow-scroll justify-center items-center">
                <h1 className="text-2xl text-center w-full">Checkout Items</h1>

                <RadioGroup className="w-full mt-4 relative flex flex-col justify-center items-center rounded-xl backdrop-blur-3xl border-2 border-solid border-[rgba(255,255,255,.2)] py-2">
                    {Object.entries(event.diff ?? {}).map(([key, val]) => {
                        if (!val) return

                        return (
                            <Radio
                                key={key}
                                value={val}
                                id={key}
                                disabled={true}
                                className="w-full flex flex-row items-center"
                            >
                                <span className="w-full pl-5 pr-10">{val?.amount - items.filter((val) => val.type === key).length}x {key}</span>
                            </Radio>
                        )
                    })}
                </RadioGroup>

                <div className="mt-8 bg-transparent outline-none border-2 border-solid border-[rgba(255,255,255,.2)] rounded-xl text-white overflow-hidden">
                    <Scanner onScan={onScan}></Scanner>
                </div>
            </form>
        </Modal>
    )
}