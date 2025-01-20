interface Blank {
    [key: string]: number
}

export interface Workspace {
    id: string,
    logoType: string,
    name: string,
    events: Event[],
    templates: Template[],
    itemTypes: ItemType[]
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
    diff?: Blank,
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