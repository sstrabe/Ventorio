'use client';

import { Scanner } from "./w/[id]/scanner";

export default function Home() {
    return (<Scanner onScan={console.log}></Scanner>)
}
