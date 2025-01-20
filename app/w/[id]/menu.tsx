'use client';

import { FaAngleRight, FaAngleLeft, FaPlus } from "react-icons/fa";
import Sidebar from "@/app/Sidebar";
import { FaAngleDown } from "react-icons/fa6";
import { useState, useEffect } from "react";
import { storage } from "@/firebase";
import { getDownloadURL, ref } from "firebase/storage";
import Image from "next/image";
import { Workspace } from "@/types/database";
import EventCreateModal from "./eventCreate";
import { useModal } from "@/contexts/modal";

export default function Menu({ data }: { data: Workspace }) {
    const [modal, setModal] = useModal();

    const [imgURL, setImgURL] = useState<string | null>(null)
    const [collapsed, setCollapsed] = useState(false)

    useEffect(() => {
        if (!data.id) return

        const imgRef = ref(storage, `${data.id}/logo.${data.logoType}`)
        const fetchIt = async () => {
            const downloadURL = await getDownloadURL(imgRef).catch(() => null)
            setImgURL(downloadURL)
        }

        fetchIt()
    }, [true])

    function onCollapseClicked() {
        setCollapsed(!collapsed)
    }

    return (
        <div className="z-50 flex h-screen flex-row left-0 w-full fixed">
            <Sidebar collapsed={collapsed}></Sidebar>

            <nav className={`top-0 left-0 h-screen m-0 border-r-2 border-solid p-2 border-[rgba(255,255,255,.2)] backdrop-blur-3xl shadow-xl transition-all duration-75 w-full`} style={{ width: collapsed ? '1rem' : '16rem' }}>
                <div className="w-full h-full flex flex-col gap-2" style={{ display: collapsed ? "none" : "flex" }}>
                    <div className="w-full bg-[rgba(51,51,51,0.7)] h-16 rounded-md flex-row-reverse items-center p-2 gap-2" style={{ display: collapsed ? 'none' : 'flex' }}>
                        <button onClick={onCollapseClicked} className="w-8 h-full bg-background rounded-md grid items-center justify-center"><FaAngleLeft size="20" className="text-white hover:cursor-pointer" /></button>
                        <div className="flex-grow h-full bg-background rounded-md flex flex-row gap-1 p-1">
                            <Image src={imgURL ?? ''} alt="workspace logo" className="w-10 h-10" width={40} height={40}></Image>
                            <div className="flex-grow flex flex-col justify-center text-white">
                                <span className="h-1/2">{data.name}</span>
                            </div>
                        </div>
                    </div>

                    <div className="w-full bg-[rgba(51,51,51,0.7)] flex-grow rounded-md flex flex-col p-2 gap-2 justify-start">
                        <ul className="w-full flex flex-col gap-2 items-end">
                            <li className="text-white bg-background rounded-md p-2 w-full flex flex-row gap-2 items-center">
                                <FaAngleDown />
                                <span>Events</span>
                                <button className="flex flex-grow justify-end flex-row w-auto hover:cursor-pointer" onClick={() => setModal('eventCreate')}><FaPlus /></button>
                            </li>
                            {data.events.map((e) => (
                                <a key={e.id} className="bg-background rounded-md p-1 w-[95%]" href={`/w/${data.id}/events/${e.id}`}>{e.name}</a>
                            ))}
                        </ul>
                    </div>
                </div>

                <button onClick={onCollapseClicked} className="w-4 h-8 bg-background rounded-md" style={{ display: collapsed ? 'flex' : 'none' }}>
                    <FaAngleRight size="20" className="place-self-center text-white hover:cursor-pointer" />
                </button>
            </nav>

            <EventCreateModal templates={data.templates} visible={modal==='eventCreate'}  workspaceId={data.id}></EventCreateModal>
        </div>
    )
}