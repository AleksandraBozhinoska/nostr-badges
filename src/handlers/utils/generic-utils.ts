// validation and parsing
export const validateKey = (pk: string): boolean => {
    return /^[0-9a-f]{64}$/.test(pk)
}

export const validateEventId = (id: string): boolean => {
    return /^[0-9a-f]{64}$/.test(id)
}

export const parseNumericParam = (param: any): number | undefined => {
    if ((typeof param !== 'string') || isNaN(parseInt(param))) {
        return undefined
    }
    return parseInt(param)
}

// date time
export const currentDateToUnixSeconds = (): number => {
    return Math.floor(Date.now() / 1000)
}