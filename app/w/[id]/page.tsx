'use client';

import Menu, { Workspace } from "./menu"

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { DocumentData, doc, getDoc } from "firebase/firestore";
import { firestore } from "@/firebase"

export default function Page() {
    const { id: workspaceId } = useParams<{ id: string }>()
    const [data, setData] = useState<DocumentData|null>(null)

    useEffect(() => {
        const fetchDocument = async () => {
            const ref = doc(firestore, 'workspaces', workspaceId)
            const docu = await getDoc(ref)

            if (!docu.exists()) return setData(null)

            document.title = `Ventorio | ${docu.data().name}`
            
            const docData = docu.data()
            docData.id = workspaceId

            setData(docData)
        }

        fetchDocument()
    }, [workspaceId])

    return (
        <div>
            {data &&
            <Menu data={data as Workspace}/>
        }
        </div>
    )
}