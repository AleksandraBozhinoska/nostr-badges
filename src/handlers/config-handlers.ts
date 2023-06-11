import {Request, Response} from 'express'
import {config} from '../models'

export const getRelayConfig = (_: Request, res: Response): void => {
    res.send(JSON.stringify(config))
}

export const setRelayConfig = (req: Request, res: Response): void => {
    const reqBody: string[] = req?.body?.relays

    if (!reqBody || !reqBody.length) {
        res.status(400)
        res.send('Please provide list of relays.')
        return
    }

    config.relays = reqBody
    res.send('Response')
}