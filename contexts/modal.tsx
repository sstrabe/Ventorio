import { createContext, Dispatch, ReactNode, SetStateAction, useContext, useState } from "react";

const ModalContext = createContext<[string, Dispatch<SetStateAction<string>>] | null>(null)

export function useModal() {
    return useContext(ModalContext!) as [string, Dispatch<SetStateAction<string>>]
}

export default function ModalProvider({ children }: { children: ReactNode }) {
    const [currentModal, setModal] = useState<string>('')

    return (
        <ModalContext.Provider value={[currentModal, setModal]}>
            {children}
        </ModalContext.Provider>
    )
}