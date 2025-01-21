interface Blank {
    [key: string]: {
        amount: number,
        constant: boolean
    }
}

export type Equipment = MultiUse | OneUse

export interface MultiUse {
    serial: string
    type: string
    lastUsed: Date
    lastCleaned: Date
    lastMaintenanced: Date
}

export interface OneUse {
    serial: string
    type: string
    amount: string
}

export interface Workspace {
    id: string,
    logoType: string,
    name: string,
    events: Event[],
    templates: Template[],
    itemTypes: ItemType[],
    equipment: Map<string, Equipment>
}

export interface Diff {
    [key: string]: {
        amount: number,
        replace: boolean
    } | undefined
}

export interface Event {
    id: string
    name?: string,
    attendance?: number,
    diff?: Diff,
    template?: string,
    manager?: string,
    date?: Date
}

export interface Template {
    name: string,
    items: Blank
}

export interface ItemType {
    name: string,
    oneUse: boolean
}