import { Workspace } from "@/types/database"
import { FaPlus, FaSignOutAlt, FaUser, FaExclamationCircle } from "react-icons/fa";
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

export default function Sidebar({ collapsed }: { collapsed: boolean }) {
    const [workspaces, setWorkspaces] = useState<Workspace[]>([])
    const [profileMenuOpen, setProfileMenuOpen] = useState(false)

    const auth = useAuth()
    const router = useRouter()

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

    function signOut() {
            firebaseSignOut(firebaseAuth)
            router.push('/auth/login')
        }

    return (
        <div>
            <nav className="h-screen w-[calc(4.5rem)] border-r-2 border-solid border-[rgba(255,255,255,.2)] backdrop-blur-3xl shadow-xl z-10
                flex flex-col-reverse items-center justify-start overflow-visible py-2
                " style={{ display: collapsed ? "none" : "flex" }}>
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