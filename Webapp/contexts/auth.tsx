import { onAuthStateChanged, User } from "firebase/auth";
import { User as DatabaseUser } from "@/types/database"
import { usePathname, useRouter } from "next/navigation";
import { auth, firestore } from "@/firebase";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";

interface AuthContext {
    currentUser: User & { data: DatabaseUser } | null
    loading: boolean
}

const AuthContext = createContext<AuthContext | null>(null)

export function useAuth() {
    return useContext(AuthContext) as AuthContext
}

export default function AuthProvider({ children }: { children: ReactNode }) {
    const [currentUser, setCurrentUser] = useState<User & { data: DatabaseUser }|null>(null);
    const [loading, setLoading] = useState(true);

    const pathname = usePathname()
    const router = useRouter()

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, initUser);
        return unsubscribe
    }, [])

    async function initUser(user: User | null) {

        const document = await getDoc(doc(firestore, 'users', user?.uid ?? 'blank'));
        if (user && document.exists()) {
            const newUser: User & { data: DatabaseUser } = user as User & { data: DatabaseUser };
            newUser.data = document.data() as DatabaseUser

            setCurrentUser(newUser)

            if (pathname.startsWith('/auth')) {
                router.push('/')
            }
        } else {
            setCurrentUser(null)

            if (!pathname.startsWith('/auth') && !pathname.startsWith('/api')) {
                router.push('/auth/login')
            }
        }
        setLoading(false)
    }

    const value = {
        currentUser,
        loading
    }

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    )
}