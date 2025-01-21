'use client';

import Menu from "./menu"
import { Workspace, Event, Equipment } from "@/types/database";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { DocumentData, doc, getDoc, query, getDocs, collection } from "firebase/firestore";
import { firestore } from "@/firebase"
import ModalProvider from "@/contexts/modal";

export default function Page() {
    const { id: workspaceId } = useParams<{ id: string }>()
    const [data, setData] = useState<DocumentData | null>(null)

    useEffect(() => {
        const fetchDocument = async () => {
            const ref = doc(firestore, 'workspaces', workspaceId)
            const docu = await getDoc(ref)

            if (!docu.exists()) return setData(null)

            document.title = `Ventorio | ${docu.data().name}`

            const q = query(collection(firestore, 'workspaces', workspaceId, 'events'))
            const snap = await getDocs(q)

            const events = snap.docs.map((doc) => (
                { ...doc.data(), id: doc.id } as Event
            ))

            const equipQ = query(collection(firestore, 'workspaces', workspaceId, 'equipment'))
            const equipSnap = await getDocs(equipQ)

            const equipment = equipSnap.docs.map((doc) => (
                { ...doc.data(), serial: doc.id } as Equipment
            ))

            const docData = docu.data()
            docData.id = workspaceId
            docData.events = events
            docData.equipment = new Map(equipment.map((val) => [val.serial, val]))

            setData(docData)
        }

        fetchDocument()
    }, [workspaceId])

    if (!data) return (
        <div>Loading...</div>
    )

    return (
        <>
            <ModalProvider>
                <Menu data={data as Workspace} />
            </ModalProvider>
        </>
    )
}