import {config} from './models'
import {NextFunction, Request, Response} from 'express'

export const checkRelays = (_: Request, res: Response, next: NextFunction): void => {
    if (!config?.relays?.length) {
        res.send('Please setup desired list of relays.')
    }
    next()
}