import {Request, Response} from 'express'
import {issuer, receiver} from '../models'
import {Event, getEventHash, getPublicKey, getSignature, Kind, UnsignedEvent} from 'nostr-tools'
import {
    composeTagAContent,
    connectToAllRelays,
    connectToAnyRelay,
    getAllBadges,
    getBadgesForPubKey,
    publishEvent,
    readBadgeAwardEvents,
    readBadgeDefinitionEventById,
    readBadgeDefinitionEvents,
    validateEvent,
} from './utils/badge-utils'
import {currentDateToUnixSeconds, parseNumericParam, validateEventId, validateKey} from './utils/generic-utils'

export const createBadgeDefinition = async (req: Request, res: Response): Promise<void> => {
    //could be read from request for this demo, not acceptable otherwise
    const sk: string = req.body?.sk || issuer.sk
    const content: string = req.body?.content || ''

    if (!validateKey(sk)) {
        res.status(400).send('Please provide valid secret key.')
    }
    let uniqueName: string = req.body?.uniqueName
    if (!uniqueName) {
        res.status(400).send('Please provide unique name for the badge definition.')
    }
    let shortName: string = req.body?.shortName
    if (!shortName) {
        res.status(400).send('Please provide short name for the badge definition.')
    }

    let event: UnsignedEvent = {
        kind: Kind.ProfileBadge,
        created_at: currentDateToUnixSeconds(),
        tags: [['d', uniqueName], ['name', shortName]],
        content: content,
        pubkey: getPublicKey(sk)
    }

    let signedEvent: Event = {
        ...event,
        id: getEventHash(event),
        sig: getSignature(event, sk),
    }

    if (!validateEvent(signedEvent)) {
        res.status(500).send('An error occurred in event creation.')
    }

    res.send(await connectToAllRelays(relay => publishEvent(relay, signedEvent)))
}

export const getBadgeDefinitions = async (req: Request, res: Response): Promise<void> => {
    const pk: any = req.params?.pk
    if (!pk || (typeof pk !== 'string')) {
        res.status(400).send('Please provide public key for the badge definitions.')
    }
    if (!validateKey(pk)) {
        res.status(400).send('Please provide valid public key.')
    }
    res.send(await connectToAnyRelay(relay => readBadgeDefinitionEvents(relay, [pk as string])))
}

export const awardBadgeToPubkey = async (req: Request, res: Response): Promise<void> => {
    //could be read from request for this demo, not acceptable otherwise
    const sk: string = req.body?.sk || issuer.sk
    const content: string = req.body?.content || ''

    if (!validateKey(sk)) {
        res.status(400).send('Please provide valid secret key.')
    }
    let awardPk: string = req.body?.awardPk
    if (!awardPk || !validateKey(awardPk)) {
        res.status(400).send('Please provide public key to award.')
    }
    let badgeId: string = req.body?.badgeId
    if (!badgeId || !validateEventId(badgeId)) {
        res.status(400).send('Please provide valid badge id to be rewarded.')
    }

    let pk = getPublicKey(sk)
    try {
        const badgeDefinition: Event | undefined = await connectToAnyRelay(relay => readBadgeDefinitionEventById(relay, badgeId, pk))
        if (!badgeDefinition) {
            res.status(400).send('Invalid badge id provided.')
        }

        const badgeUniqueNameTag: string[] | undefined = (badgeDefinition as Event).tags.find(el => el[0] === 'd');
        const badgeUniqueName = (badgeUniqueNameTag as string[])[1]

        let event: UnsignedEvent = {
            kind: Kind.BadgeAward,
            created_at: currentDateToUnixSeconds(),
            tags: [['a', composeTagAContent(pk, badgeUniqueName)], ['p', awardPk]],
            content: content,
            pubkey: pk
        }

        let signedEvent: Event = {
            ...event,
            id: getEventHash(event),
            sig: getSignature(event, sk),
        }

        if (!validateEvent(signedEvent)) {
            res.status(500).send('An error occurred in event creation.')
        }

        res.send(await connectToAllRelays(relay => publishEvent(relay, signedEvent)))
    } catch (error: any) {
        res.status(500).send('An error occurred in event creation.')
    }
}

export const getBadgesAwardedToPubkey = async (req: Request, res: Response): Promise<void> => {
    const pk: any = req.params?.pk
    if (!pk || (typeof pk !== 'string')) {
        res.status(400).send('Please provide public key for the badge definitions.')
    }
    if (!validateKey(pk)) {
        res.status(400).send('Please provide valid public key.')
    }

    res.send(await getBadgesForPubKey(pk, false))
}

export const getBadgesAcceptedByPubkey = async (req: Request, res: Response): Promise<void> => {
    const pk: any = req.params?.pk
    if (!pk || (typeof pk !== 'string')) {
        res.status(400).send('Please provide public key for the badge definitions.')
    }
    if (!validateKey(pk)) {
        res.status(400).send('Please provide valid public key.')
    }

    res.send(await getBadgesForPubKey(pk, true))
}

export const createBadgeProfile = async (req: Request, res: Response): Promise<void> => {
    //could be read from request for this demo, not acceptable otherwise
    const sk: string = req.body?.sk || receiver.sk
    const content: string = req.body?.content || ''

    if (!validateKey(sk)) {
        res.status(400).send('Please provide valid secret key.')
    }
    let awardIds: string[] = req.body?.awardIds
    if (!awardIds) {
        res.status(400).send('Please provide list of award event ids to be accepted.')
    }

    let awardedEvents: Event[] = await connectToAnyRelay(relay => readBadgeAwardEvents(relay, [getPublicKey(sk) as string], awardIds))
    let tags: string[][] = [['d', 'profile_badges']]
    awardedEvents.forEach(awarded => tags.push(['a', (awarded.tags.find(el => el[0] === 'a') as [string, string])[1]], ['e', awarded.id]))

    let event: UnsignedEvent = {
        kind: Kind.BadgeDefinition,
        created_at: currentDateToUnixSeconds(),
        tags: tags,
        content: content,
        pubkey: getPublicKey(sk)
    }

    let signedEvent: Event = {
        ...event,
        id: getEventHash(event),
        sig: getSignature(event, sk),
    }

    if (!validateEvent(signedEvent)) {
        res.status(500).send('An error occurred in event creation.')
    }

    res.send(await connectToAllRelays(relay => publishEvent(relay, signedEvent)))
}

export const getAllBadgesGiven = async (req: Request, res: Response): Promise<void> => {
    let since = parseNumericParam(req.query.since)
    let until = parseNumericParam(req.query.until)

    res.send(await getAllBadges(since, until, false))
}

export const getAllBadgesAccepted = async (req: Request, res: Response): Promise<void> => {
    let since = parseNumericParam(req.query.since)
    let until = parseNumericParam(req.query.until)

    res.send(await getAllBadges(since, until, true))
}