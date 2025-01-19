'use client';

import { FaAngleRight, FaAngleLeft, FaPlus, FaSignOutAlt, FaUser, FaExclamationCircle } from "react-icons/fa";
import { FaAngleDown } from "react-icons/fa6";
import { useState, useEffect, ReactNode } from "react";
import { storage } from "@/firebase";
import { getDownloadURL, ref } from "firebase/storage";
import { collection, getDocs, query, where, or } from "firebase/firestore";
import Image from "next/image";
import Link from "next/link"
import { useAuth } from "@/contexts/auth";
import { firestore, auth as firebaseAuth } from "@/firebase";
import { signOut as firebaseSignOut } from "firebase/auth";
import { useRouter } from "next/navigation";

export interface Workspace {
    id: string,
    logoType: string,
    name: string
}

export default function Menu({ data }: { data: Workspace }) {
    const [imgURL, setImgURL] = useState<string | null>(null)
    const [collapsed, setCollapsed] = useState(false)
    const [workspaces, setWorkspaces] = useState<Workspace[]>([])
    const [profileMenuOpen, setProfileMenuOpen] = useState(false)

    const auth = useAuth()
    const router = useRouter()

    useEffect(() => {
        if (!data.id) return

        const imgRef = ref(storage, `${data.id}/logo.${data.logoType}`)
        const fetchIt = async () => {
            const downloadURL = await getDownloadURL(imgRef).catch(() => null)
            setImgURL(downloadURL)


        }

        fetchIt()
    }, [true])

    useEffect(() => {
        if (!auth.currentUser) return

        const fetchWorkspaces = async () => {
            const q = query(collection(firestore, 'workspaces'), or(where('members', 'array-contains', auth.currentUser?.uid), where('owner', '==', auth.currentUser?.uid)))
            const snapshot = await getDocs(q)
            setWorkspaces(
                snapshot.docs.map((doc) => (
                    { ...doc.data(), id: doc.id } as Workspace
                ))
            )
        }

        fetchWorkspaces()
    }, [true, auth])

    function onCollapseClicked() {
        setCollapsed(!collapsed)
    }

    function signOut() {
        firebaseSignOut(firebaseAuth)
        router.push('/auth/login')
    }

    return (
        <div className="z-50 flex h-screen flex-row left-0 w-full fixed">
            <nav className="h-screen w-[calc(4.5rem)] border-r-2 border-solid border-[rgba(255,255,255,.2)] backdrop-blur-3xl shadow-xl z-10
            flex flex-col-reverse items-center justify-start overflow-visible py-2
            ">
                <SidebarIcon hoverBg={true} onClick={() => setProfileMenuOpen(!profileMenuOpen)}><FaUser size="28" /></SidebarIcon>

                <ul className="flex flex-col items-center justify-start flex-grow overflow-auto w-full" style={{ scrollbarGutter: "stable both-edges" }}>
                    <SidebarIcon href="/" hoverBg={true}><Image src="/logo.svg" alt="logo" className="w-7 h-7" width={28} height={28}></Image></SidebarIcon>
                    <div className="h-1 mt-2 bg-[rgba(49,45,44,0.5)] border-0 w-12 rounded-full mb-4 flex-shrink-0" />

                    {workspaces.map((workspace) => (<WorkspaceIcon name={workspace.name} key={workspace.id} id={workspace.id} fileType={workspace.logoType} />))}

                    <SidebarIcon href="/" hoverBg={true}><FaPlus size="28" /></SidebarIcon>
                </ul>
            </nav>

            <div className="absolute left-[calc(4.5rem)] m-2 w-52 p-2 z-10 backdrop-blur-3xl shadow-xl border-2 rounded-lg border-solid border-[rgba(255,255,255,.2)]
                flex flex-col items-center gap-1 text-white transition-all duration-300
            " style={{ bottom: profileMenuOpen ? "0.50rem" : "-13.5rem" }}>
                <button name="Sign Out" className="w-full bg-background rounded-[4px] flex flex-row items-center justify-start px-2 gap-1" onClick={signOut}>
                    <FaSignOutAlt size="16" />
                    Sign Out
                </button>
                <Link className="w-full bg-background rounded-[4px] flex flex-row items-center justify-start px-2 gap-1" href="/profile">
                    <FaUser size="16" />
                    Profile
                </Link>
            </div>

            <nav className={`top-0 left-0 h-screen m-0 border-r-2 border-solid p-2 border-[rgba(255,255,255,.2)] backdrop-blur-3xl shadow-xl transition-all duration-75 w-full`} style={{ width: collapsed ? '1rem' : '16rem' }}>
                <div className="w-full h-full flex flex-col gap-2" style={{ display: collapsed ? "none" : "flex" }}>
                    <div className="w-full bg-[rgba(51,51,51,0.7)] h-16 rounded-md flex-row-reverse items-center p-2 gap-2" style={{ display: collapsed ? 'none' : 'flex' }}>
                        <button onClick={onCollapseClicked} className="w-8 h-full bg-background rounded-md"><FaAngleLeft size="20" className="place-self-center text-white hover:cursor-pointer" /></button>
                        <div className="flex-grow h-full bg-background rounded-md flex flex-row gap-1 p-1">
                            <Image src={imgURL ?? ''} alt="workspace logo" className="w-10 h-10" width={40} height={40}></Image>
                            <div className="flex-grow flex flex-col justify-center text-white">
                                <span className="h-1/2">{data.name}</span>
                            </div>
                        </div>
                    </div>

                    <div className="w-full bg-[rgba(51,51,51,0.7)] flex-grow rounded-md flex flex-col-reverse p-2 gap-2">
                        <ul className="w-full flex-grow flex flex-col">
                            <li className="text-white bg-background rounded-md p-2 w-full flex flex-row gap-2 items-center">
                                <FaAngleDown /><span>Events</span><div className="flex flex-grow justify-end flex-row w-auto"><FaPlus /></div>
                            </li>
                        </ul>
                    </div>
                </div>
                <button onClick={onCollapseClicked} className="w-4 h-8 bg-background rounded-md" style={{ display: collapsed ? 'flex' : 'none' }}><FaAngleRight size="20" className="place-self-center text-white hover:cursor-pointer" /></button>
            </nav>
        </div>
    )
}

const SidebarIcon = ({ children, href, hoverBg, onClick }: { children: ReactNode, href?: string, hoverBg: boolean, onClick?: () => unknown }) => {
    if (href) {
        return (
            <Link href={href} className={`relative flex items-center justify-center h-12 w-12 min-h-12 bg-background rounded-3xl text-white transition-all duration-200 cursor-pointer hover:rounded-lg ${hoverBg ? 'hover:bg-auxiliary1' : ''} mb-2`}>
                <div className="flex items-center justify-center overflow-hidden w-full h-full group-hover:rounded-lg rounded-3xl transition-all duration-200 bg-transparent">
                    {children}
                </div>
            </Link>
        )
    } else if (onClick) {
        return (
            <button onClick={onClick} className={`relative flex items-center justify-center h-12 w-12 min-h-12 bg-background rounded-3xl text-white transition-all duration-200 cursor-pointer hover:rounded-lg ${hoverBg ? 'hover:bg-auxiliary1' : ''} mb-2`}>
                <div className="flex items-center justify-center overflow-hidden w-full h-full group-hover:rounded-lg rounded-3xl transition-all duration-200 bg-transparent">
                    {children}
                </div>
            </button>
        )
    }
}

const WorkspaceIcon = ({ id, fileType }: { id: string, name: string, fileType: string }) => {
    const [imgURL, setImgURL] = useState<string | null>(null)

    useEffect(() => {
        const imgRef = ref(storage, `${id}/logo.${fileType}`)
        const fetchIt = async () => {
            const downloadURL = await getDownloadURL(imgRef).catch(() => null)
            setImgURL(downloadURL)
        }

        fetchIt()
    }, [true])

    return (
        <SidebarIcon href={`/w/${id}`} hoverBg={false}>{imgURL ? <img src={imgURL} className="w-[80%] h-[80%] bg-transparent border-none" alt="logo" /> : <FaExclamationCircle size="28" className="text-auxiliary1" />}</SidebarIcon>
    )
}