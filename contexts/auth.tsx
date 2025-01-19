import { onAuthStateChanged, User } from "firebase/auth";
import { usePathname, useRouter } from "next/navigation";
import { auth } from "@/firebase";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";

interface AuthContext {
    currentUser: User | null
    loading: boolean
}

const AuthContext = createContext<AuthContext | null>(null)

export function useAuth() {
    return useContext(AuthContext) as AuthContext
}

export default function AuthProvider({ children }: { children: ReactNode }) {
    const [currentUser, setCurrentUser] = useState<User|null>(null);
    const [loading, setLoading] = useState(true);

    const pathname = usePathname()
    const router = useRouter()

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, initUser);
        return unsubscribe
    }, [])

    async function initUser(user: User | null) {
        if (user) {
            setCurrentUser(user)

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