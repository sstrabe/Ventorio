import { createContext, Dispatch, ReactNode, SetStateAction, useContext, useState } from "react";

interface ModalData {
    name: string
    data?: {
        [key: string]: unknown
    }
}

const ModalContext = createContext<[ModalData, Dispatch<SetStateAction<ModalData>>] | null>(null)

export function useModal() {
    return useContext(ModalContext!) as [ModalData, Dispatch<SetStateAction<ModalData>>]
}

export default function ModalProvider({ children }: { children: ReactNode }) {
    const [currentModal, setModal] = useState<ModalData>({ name: '' })

    return (
        <ModalContext.Provider value={[currentModal, setModal]}>
            {children}
        </ModalContext.Provider>
    )
}