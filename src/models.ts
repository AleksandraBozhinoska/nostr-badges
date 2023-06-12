// type definitions
import {Event} from 'nostr-tools'

export type Config = {
    relays: string[]
}

export type User = {
    type: UserType
    pk: string
    sk: string
}

export enum UserType {
    ISSUER = 'issuer', RECEIVER = 'receiver', UNDEFINED = 'undefined'
}

export type ExtendedEvent = Event & {
    accepted: boolean
}

export const fromEvent = (event: Event, accepted: boolean): ExtendedEvent => {
    return {
        ...event,
        accepted: accepted
    }
}

// config
export const config: Config = {
    relays: []
    // hardcoded for simplicity of testing, test.test.io is a dummy relay address
    // relays: ['wss://relay.damus.io', 'wss://test.test.io', 'wss://relay.1bps.io']
}

// hardcoded for simplicity of testing, meant to be replaced by valid key values
let issuerSk = 'default',
    issuerPk = 'default'
let receiverSk = 'default',
    receiverPk = 'default'

export let issuer: User = {
    sk: issuerSk,
    pk: issuerPk,
    type: UserType.ISSUER
}

export let receiver: User = {
    sk: receiverSk,
    pk: receiverPk,
    type: UserType.RECEIVER
}