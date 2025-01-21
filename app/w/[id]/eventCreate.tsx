import Modal from "@/app/Modal";
import { MouseEvent as ReactMouseEvent, FormEvent, useEffect, useState } from "react";
import { FaExclamationCircle, FaCheck, FaChevronDown, FaCalendar, FaUser, FaMinusCircle } from "react-icons/fa";
import { FaCircleXmark } from "react-icons/fa6";
import { Combobox, ComboboxButton, ComboboxInput, ComboboxOption, ComboboxOptions, Radio, RadioGroup } from '@headlessui/react';
import clsx from 'clsx';
import { Diff, Template } from "@/types/database";
import { FaPenToSquare } from "react-icons/fa6";
import { addDoc, collection } from "firebase/firestore"
import { firestore } from "@/firebase";
import { useModal } from "@/contexts/modal";

export default function EventCreateModal({ visible, templates, workspaceId }: { visible: boolean, templates: Template[], workspaceId: string }) {
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [template, setTemplate] = useState<Template>();
    const [attendance, setAttendance] = useState<number>(1);
    const [templateQuery, setTemplateQuery] = useState<string>('');
    const [date, setDate] = useState<Date>();
    const [name, setName] = useState<string>();
    const [diff, setDiff] = useState<Diff>({});
    const [mod, setMod] = useState<string>();

    const [, setModal] = useModal();

    useEffect(() => {
        const newDiff: Diff = Object.fromEntries(Object.entries(template?.items || {}).map(([key, amount]) => [key, { amount: Math.ceil(amount * attendance), replace: true }]))

        for (const key in diff) {
            const val = diff[key]

            if (template?.items[key]) {
                newDiff[key] = val?.replace ? { amount: Math.ceil(template.items[key] * attendance), replace: true } : val
            } else {
                if (val?.replace) delete newDiff[key]
                else newDiff[key] = val
            }
        }

        setDiff(newDiff)
    }, [attendance, template])

    function modifyDiff(key: string, newValue: { amount: number; replace: boolean; }) {
        delete diff[key]
        setDiff({ ...diff, key: newValue })
    }

    function onSubmit(e: FormEvent) {
        e.preventDefault();

        addDoc(collection(firestore, 'workspaces', workspaceId, 'events'), {
            name, date, template: template?.name ?? 'None', attendance, diff
        })
            .catch((err) => setErrorMessage(err))
            .then(() => setModal({ name: '' }))

        
    }

    function onModClick(e: ReactMouseEvent<HTMLButtonElement, MouseEvent>) {
        console.log((e.target as HTMLElement).closest('span')?.id)
        modifyDiff((e.target as HTMLElement || null)?.closest('span')!.id, { amount: 0, replace: true })
    }

    const filteredTemplates =
        templateQuery === ''
            ? templates
            : templates.filter((tem) => tem.name.toLowerCase().includes(templateQuery.toLowerCase()));

    return (
        <Modal visible={visible}>
            <form onSubmit={onSubmit} className="m-10 w-[75vw] sm:w-[50vw] lg:w-[30vw] xl:[10vw] text-white rounded-lg p-8 bg-transparent border-solid border-2 border-[rgba(255,255,255,.2)] backdrop-blur-3xl shadow-xl max-h-[75vh] overflow-scroll">
                <h1 className="text-2xl text-center w-full flex flex-row justify-end"><span className="flex-grow">Create Event</span> <button onClick={(e) => {e.preventDefault(); setModal({ name: '' })}} className="flex justify-center items-center"><FaCircleXmark fontSize="1.2rem"></FaCircleXmark></button></h1>
                {errorMessage &&
                    <div className="w-[100%] mt-8 relative h-10 flex justify-start items-center text-white">
                        <span className="w-full h-full bg-[rgba(255,0,0,.2)] outline-none border-2 border-solid border-[rgba(255,0,0,.8)] rounded-full pt-5 pb-5 pl-5 pr-10 inline-flex items-center">{errorMessage}</span>
                        <FaExclamationCircle size="20px" className="ml-[-40px]" />
                    </div>
                }

                <div className="w-full mt-8 relative h-10 flex justify-start items-center">
                    <input type="text" onChange={(e) => { setName(e.target.value) }} placeholder="Name" required className="w-full h-full bg-transparent outline-none border-2 border-solid border-[rgba(255,255,255,.2)] rounded-full text-white pt-5 pb-5 pl-5 pr-10" />
                    {/* <FaUser size="20px" className="ml-[-40px]" /> */}
                </div>

                <Combobox onChange={(value: Template | null) => setTemplate(value ?? undefined)} onClose={() => setTemplateQuery('')}>
                    <div className="w-full mt-8 relative h-10 flex justify-start items-center">
                        <ComboboxInput
                            className="w-full h-full bg-transparent outline-none border-2 border-solid border-[rgba(255,255,255,.2)] rounded-full text-white pt-5 pb-5 pl-5 pr-10"
                            displayValue={(template: Template) => template?.name}
                            onChange={(event) => setTemplateQuery(event.target.value)}
                            placeholder="Template"
                        />
                        <ComboboxButton className="ml-[-40px]">
                            <FaChevronDown className="size-4 fill-white/60 group-data-[hover]:fill-white" />
                        </ComboboxButton>
                    </div>

                    <ComboboxOptions
                        anchor="bottom"
                        transition
                        className={clsx(
                            'w-[var(--input-width)] rounded-xl border border-white/5 bg-white/5 p-1 [--anchor-gap:var(--spacing-1)] empty:invisible backdrop-blur-3xl',
                            'transition duration-100 ease-in data-[leave]:data-[closed]:opacity-0 z-[210]'
                        )}
                    >
                        {filteredTemplates.map((template) => (
                            <ComboboxOption
                                key={template.name}
                                value={template}
                                className="group flex cursor-default items-center gap-2 rounded-lg py-1.5 px-3 select-none data-[focus]:bg-white/10"
                            >
                                <FaCheck className="invisible size-4 fill-white group-data-[selected]:visible" />
                                <div className="text-sm/6 text-white">{template.name}</div>
                            </ComboboxOption>
                        ))}
                    </ComboboxOptions>
                </Combobox>

                <div className="w-full mt-8 relative h-10 flex justify-start items-center">
                    <input type="number" onChange={(e) => { setAttendance(+e.target.value) }} placeholder="Attendance" required className="w-full h-full bg-transparent outline-none border-2 border-solid border-[rgba(255,255,255,.2)] rounded-full text-white pt-5 pb-5 pl-5 pr-10" />
                    <FaUser size="20px" className="ml-[-40px]" />
                </div>

                <div className="w-full mt-8 relative h-10 flex justify-start items-center">
                    <input type="datetime-local" aria-label="date" onChange={(e) => { setDate(new Date(e.target.value)) }} placeholder="Email" required className="w-full h-full bg-transparent outline-none border-2 border-solid border-[rgba(255,255,255,.2)] rounded-full text-white pt-5 pb-5 pl-5 pr-10" />
                    <FaCalendar size="20px" className="ml-[-40px]" />
                </div>

                <div className="w-full mt-8 relative h-10 flex justify-start items-center">
                    <input type="text" onChange={(e) => { setMod(e.target.value) }} placeholder="Modifications" className="w-full h-full bg-transparent outline-none border-2 border-solid border-[rgba(255,255,255,.2)] rounded-full text-white pt-5 pb-5 pl-5 pr-10" />
                    <FaPenToSquare size="20px" className="ml-[-40px] hover:cursor-pointer" onClick={() => {
                        const key = mod?.split(': ')[0] ?? ''
                        const val = mod?.split(': ')[1] ?? ''
                        const newDiff = { ...diff }

                        newDiff[key] = { amount: +val, replace: false }
                        setDiff(newDiff)
                    }} />
                </div>

                <RadioGroup className="w-full mt-4 relative flex flex-col justify-center items-center rounded-xl backdrop-blur-3xl border-2 border-solid border-[rgba(255,255,255,.2)] py-2">
                    {Object.entries(diff).map(([key, val]) => {
                        if (!val) return

                        return (
                            <Radio
                                key={key}
                                value={val}
                                id={key}
                                disabled={true}
                                className="w-full flex flex-row items-center"
                            >
                                <span className="w-full pl-5 pr-10">{key}: {val?.amount}</span>
                                <button className="ml-[-40px]" onClick={(e) => { e.preventDefault(); onModClick(e) }}>
                                    <FaMinusCircle />
                                </button>
                            </Radio>
                        )
                    })}
                </RadioGroup>

                <button type="submit" className="w-full h-[45px] bg-white mt-5 rounded-full border-none outline-none shadow-sm cursor-pointer text-[#333] text-lg font-semibold">Create</button>
            </form>
        </Modal>
    )
}