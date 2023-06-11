import {issuer, receiver, User} from '../models'
import {generatePrivateKey, getPublicKey} from 'nostr-tools'
import {Request, Response} from 'express'

const setupUser = (user: User): void => {
    let sk = generatePrivateKey()

    user.sk = sk
    user.pk = getPublicKey(sk)

    console.log(`Secret key for user type ${user.type}: ${sk}`)
    console.log(`Public key for user type ${user.type}: ${user.pk}`)
}

export const setupIssuer = (_: Request, res: Response): void => {
    setupUser(issuer);
    res.send()
}

export const setupReceiver = (_: Request, res: Response): void => {
    setupUser(receiver);
    res.send()
}