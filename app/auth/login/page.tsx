'use client';

import { FormEvent, useState } from "react";
import { FaUser, FaLock, FaExclamationCircle } from "react-icons/fa";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "@/firebase";

export default function Page() {
    const router = useRouter()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [errorMessage, setErrorMessage] = useState('')

    const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()

        signInWithEmailAndPassword(auth, email, password)
            .then(() => router.push('/'))
            .catch((err) => {setErrorMessage('Invalid Credentials'); console.log(err)})
    }

    const onGoogleSignIn = async (e: FormEvent<HTMLButtonElement>) => {
        e.preventDefault()

        const provider = new GoogleAuthProvider();
        signInWithPopup(auth, provider)
            .then(() => router.push('/'))
            .catch((err) => {setErrorMessage('Something went wrong'); console.log(err)});
    }

    return (
        <div className="w-screen h-screen flex justify-center items-center">
            <form onSubmit={onSubmit} className="m-10 w-[75vw] sm:w-[50vw] lg:w-[30vw] xl:[10vw] text-white rounded-lg p-8 bg-transparent border-solid border-2 border-[rgba(255,255,255,.2)] backdrop-blur-3xl shadow-xl place-self-center">
                <h1 className="text-4xl text-center">Login</h1>
                {errorMessage &&
                    <div className="w-[100%] mt-[30px] relative h-10 flex justify-start items-center text-white">
                        <span className="w-full h-full bg-[rgba(255,0,0,.2)] outline-none border-2 border-solid border-[rgba(255,0,0,.8)] rounded-full pt-5 pb-5 pl-5 pr-10 inline-flex items-center">{errorMessage}</span>
                        <FaExclamationCircle size="20px" className="ml-[-40px]" />
                    </div>
                }

                <div className="w-[100%] mt-[30px] relative h-10 flex justify-start items-center">
                    <input type="email" onChange={(e) => { setEmail(e.target.value) }} placeholder="Email" required className="w-full h-full bg-transparent outline-none border-2 border-solid border-[rgba(255,255,255,.2)] rounded-full placeholder:text-white pt-5 pb-5 pl-5 pr-10" />
                    <FaUser size="20px" className="ml-[-40px]" />
                </div>

                <div className="w-[100%] mt-[30px] relative h-10 flex justify-start items-center">
                    <input type="password" onChange={(e) => { setPassword(e.target.value) }} placeholder="Password" required className="w-full h-full bg-transparent outline-none border-2 border-solid border-[rgba(255,255,255,.2)] rounded-full placeholder:text-white pt-5 pb-5 pl-5 pr-10" />
                    <FaLock size="20px" className="ml-[-40px]" />
                </div>

                <div className="flex justify-center items-center text-sm mt-[15px] mb-[15px] mx-5 flex-col gap-2">
                    <a href="#" className="hover:underline">Forgot Password?</a>
                </div>

                <button type="submit" className="w-full h-[45px] bg-white mt-5 rounded-full border-none outline-none shadow-sm cursor-pointer text-[#333] text-lg font-semibold">Login</button>

                <button type="button" onClick={onGoogleSignIn} className="w-full h-[45px] bg-white flex flex-row items-center justify-center mt-5 rounded-full border-none outline-none shadow-sm cursor-pointer text-[#333] text-lg font-semibold">Continue with Google</button>
            </form>
        </div>
    )
}