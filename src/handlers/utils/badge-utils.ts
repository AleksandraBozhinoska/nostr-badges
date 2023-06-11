import {Event, Kind, relayInit, validateEvent as nostrValidate, verifySignature} from 'nostr-tools'
import {config, ExtendedEvent, fromEvent} from '../../models'
import 'websocket-polyfill'
import {Relay} from 'nostr-tools/lib/relay'
import {Filter} from 'nostr-tools/lib/filter'

export const extendResult = (result: [string, boolean, any]): [[string, string], [string, boolean], [string, any]] => {
    return [['relay', result[0]], ['connectSuccess', result[1]], ['operationSuccess', result[2]]]
}

export const validateEvent = (event: Event): boolean => {
    return nostrValidate(event) && verifySignature(event)
}

export const connectToAllRelays = async (onConnectOp: (relay: Relay) => Promise<any>): Promise<[[string, string], [string, boolean], [string, any]] []> => {
    return await Promise.all(
        config.relays.map(
            async relay => {
                const connInit = relayInit(relay)
                try {
                    await connInit.connect()
                    try {
                        const opResult = await onConnectOp(connInit)
                        connInit.close()
                        return extendResult([relay, true, opResult])
                    } catch (err: any) {
                        return extendResult([relay, true, false])
                    }
                } catch (error: any) {
                    connInit.close()
                    // operation result should only be set to null in case connect fails
                    // therefore all connect operations should not allow null result
                    return extendResult([relay, false, null])
                }
            }))
}

export const connectToAnyRelay = async (onConnectOp: (relay: Relay) => Promise<any>): Promise<any | undefined> => {
    const promises = config.relays.map(
        async relay => {
            const connInit = relayInit(relay)
            try {
                await connInit.connect()
                try {
                    console.log(`Trying to connect to ${connInit.url}`)
                    const opResult = await onConnectOp(connInit)
                    connInit.close()
                    return extendResult([relay, true, opResult])
                } catch (err: any) {
                    return extendResult([relay, true, false])
                }
            } catch (error: any) {
                connInit.close()
                // operation result should only be set to null in case connect fails
                // therefore all connect operations should not allow null result
                return extendResult([relay, false, null])
            }
        });

    for (const promise of promises) {
        let result = await promise
        if (result[1][1] && result[2][1] !== null) {
            return result[2][1]
        }
    }

    return undefined
}

export const publishEvent = async (relay: Relay, event: Event): Promise<boolean> => {
    return new Promise<boolean>((resolve, reject) => {
        const pub = relay.publish(event)
        pub.on('ok', () => {
            console.log(`${relay.url} has accepted the event`)
            resolve(true)
        })
        pub.on('failed', () => {
            console.log(`failed to publish to ${relay.url}`)
            reject(false)
        })
    })
}

export const readBadgeDefinitionEvents = async (relay: Relay, pks: string[]): Promise<Event[]> => {
    return new Promise<Event[]>((resolve, _) => {
        let events: Event[] = []
        const sub = relay.sub([{
            kinds: [Kind.ProfileBadge],
            authors: pks
        }])
        sub.on('event', (event) => {
            events.push(event)
        })
        sub.on('eose', () => {
            sub.unsub()
            resolve(events)
        })
    })
}

export const readBadgeDefinitionEventById = async (relay: Relay, id: string, pk: string): Promise<Event | undefined> => {
    return new Promise<Event | undefined>((resolve, _) => {
        const sub = relay.sub([{
            kinds: [Kind.ProfileBadge],
            authors: [pk],
            ids: [id]
        }])
        sub.on('event', (event) => {
            resolve(event)
        })
        sub.on('eose', () => {
            sub.unsub()
            resolve(undefined)
        })
    })
}

export const composeTagAContent = (issuer: string, id: string): string => {
    return `${Kind.ProfileBadge}:${issuer}:${id}`
}

export const readBadgeAwardEvents = async (relay: Relay, awardedPks?: string[], ids?: string[], since?: number, until?: number): Promise<Event[]> => {
    return new Promise<Event[]>((resolve, _) => {
        let events: Event[] = []

        let filter: Filter = {
            kinds: [Kind.BadgeAward],
        }

        if (awardedPks && awardedPks.length) {
            filter['#p'] = awardedPks
        }

        if (ids && ids.length) {
            filter.ids = ids
        }

        if (since) {
            filter.since = since
        }

        if (until) {
            filter.until = until
        }

        const sub = relay.sub([filter])
        sub.on('event', (event) => {
            events.push(event)
        })
        sub.on('eose', () => {
            sub.unsub()
            resolve(events)
        })
    })
}

export const readProfileBadgeEventById = async (relay: Relay, pks: string[]): Promise<Event | undefined> => {
    return new Promise<Event | undefined>((resolve, _) => {
        const sub = relay.sub([{
            kinds: [Kind.BadgeDefinition],
            authors: pks,
            '#d': ['profile_badges']
        }])
        sub.on('event', (event) => {
            resolve(event)
        })
        sub.on('eose', () => {
            sub.unsub()
            resolve(undefined)
        })
    })
}

export const readProfileBadgeEvents = async (relay: Relay, pks: string[]): Promise<Event[]> => {
    return new Promise<Event[]>((resolve, _) => {
        let events: Event[] = []
        const sub = relay.sub([{
            kinds: [Kind.BadgeDefinition],
            authors: pks,
            '#d': ['profile_badges']
        }])
        sub.on('event', (event) => {
            events.push(event)
        })
        sub.on('eose', () => {
            sub.unsub()
            resolve(events)
        })
    })
}

export const extractTagValuesForKey = (event: Event, tagKey: string): string[] => {
    return event.tags.filter(el => el[0] === tagKey).map(arr => arr[1])
}

export const getBadgesForPubKey = async (pk: string, acceptedOnly: boolean): Promise<ExtendedEvent[] | Event[]> => {
    let awardedEvents: Event[] = await connectToAnyRelay(relay => readBadgeAwardEvents(relay, [pk]))
    let profileBadges: Event | undefined = await connectToAnyRelay(relay => readProfileBadgeEventById(relay, [pk]))

    if (!profileBadges) {
        // no profile badges are accepted
        if (acceptedOnly) {
            return []
        }

        return awardedEvents.map(awarded => fromEvent(awarded, false))
    } else {
        if (acceptedOnly) {
            return awardedEvents.filter(awarded => extractTagValuesForKey((profileBadges as Event), 'e').includes(awarded.id))
        }
        return awardedEvents.map(awarded => fromEvent(awarded, extractTagValuesForKey((profileBadges as Event), 'e').includes(awarded.id)))
    }
}

export const getAllBadges = async (since: number | undefined, until: number | undefined, acceptedOnly: boolean): Promise<ExtendedEvent[] | Event[]> => {
    // fetch all events per the given criteria
    let awardedEvents: Event[] = await connectToAnyRelay(relay => readBadgeAwardEvents(relay, undefined, undefined, since, until))

    // extract unique public keys
    let awardedPksPerId = new Map<string, string[]>();
    const pks: Set<string> = new Set<string>(awardedEvents.map(event => {
        const awardedPks: string[] = extractTagValuesForKey(event, 'p')
        awardedPksPerId.set(event.id, awardedPks)

        return awardedPks
    }).flat())

    // fetch badge profile events for the public keys
    let badgeEvents: Event[] = await connectToAnyRelay(relay => readProfileBadgeEvents(relay, Array.from(pks.values())))

    if (!badgeEvents.length) {
        // no profile badges are accepted
        if (acceptedOnly) {
            return []
        }

        return awardedEvents.map(awarded => fromEvent(awarded, false))
    }

    // create a map of public keys and accepted award events
    let acceptedIdsPerPk = new Map<string, string[]>();
    badgeEvents.map(event => acceptedIdsPerPk.set(event.pubkey, extractTagValuesForKey(event, 'e')))

    if (acceptedOnly) {
        return awardedEvents.filter(awarded => {
            const pksInEvent: string[] | undefined = awardedPksPerId.get(awarded.id)
            let acceptedByAtLeastOnePk: boolean = false

            if (pksInEvent) {
                for (let pk of pksInEvent) {
                    const acceptedPerPk: string[] | undefined = acceptedIdsPerPk.get(pk)
                    if (acceptedPerPk && acceptedPerPk.includes(awarded.id)) {
                        acceptedByAtLeastOnePk = true
                        break
                    }
                }
            }

            return acceptedByAtLeastOnePk
        })
    }

    return awardedEvents.map(awarded => {
        const pksInEvent: string[] | undefined = awardedPksPerId.get(awarded.id)
        let acceptedByAtLeastOnePk: boolean = false

        if (pksInEvent) {
            for (let pk of pksInEvent) {
                const acceptedPerPk: string[] | undefined = acceptedIdsPerPk.get(pk)
                if (acceptedPerPk && acceptedPerPk.includes(awarded.id)) {
                    acceptedByAtLeastOnePk = true
                    break
                }
            }
        }

        return fromEvent(awarded, acceptedByAtLeastOnePk)
    })
}