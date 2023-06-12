import express from 'express'
import apicache from 'apicache'
import {getRelayConfig, setRelayConfig} from './handlers/config-handlers'
import {setupIssuer, setupReceiver} from './handlers/user-handlers'
import {checkRelays} from './middleware'
import {
    awardBadgeToPubkey,
    createBadgeDefinition,
    createBadgeProfile,
    getAllBadgesAccepted,
    getAllBadgesGiven,
    getBadgeDefinitions,
    getBadgesAcceptedByPubkey,
    getBadgesAwardedToPubkey
} from './handlers/badge-handlers'

const hostname = '127.0.0.1'
const port = 3000

const server = express()
const cache = apicache.middleware
/**
 * General documentation: cache middleware is applied to the GET endpoints, caching the response for the set
 * CACHE_DURATION value below.
 * POST endpoints attempt to create the events on all configured relays - improvement: retry mechanism can be added for
 * the relays to which the connection fails.
 * GET endpoints return response from the first relay to which the connection attempt succeeds (assumes that relays have
 * the same data) - improvement: logic for combining data from all configured relays can be added.
 */
const CACHE_DURATION = '40 seconds'

// === SERVER CONFIG ===
server.use(express.json())

/**
 * Used for testing - it sets up key pair for an internal 'issuer' user in order to use those keys in the endpoints
 * that create events without providing a secret key as part of the request.
 * e.g., a scenario: create a badge definition
 *
 * However, providing the secret key is supported in the endpoints as well.
 * No query params or path variables are required.
 */
server.post('/setup-issuer', setupIssuer)

/**
 * Used for testing - it sets up key pair for an internal 'receiver' user in order to use those keys in the endpoints
 * that create events without providing a secret key as part of the request.
 * e.g., a scenario: create a profile badges event
 *
 * However, providing the secret key is supported in the endpoints as well.
 * No query params or path variables are required.
 */
server.post('/setup-receiver', setupReceiver)


/**
 * Returns the current relay config.
 */
server.get('/relay-config', cache(CACHE_DURATION), getRelayConfig)

/**
 * Sets the relay config.
 * Expects json body with 'relays' property of type string array.
 *
 * Previously set config can be updated, but previously created events will not be available on the newly added relays.
 */
server.post('/relay-config', setRelayConfig)


// === BADGES API ===
/**
 * Creates a badge definition.
 * Expects json body with following properties:
 * - sk (optional), the sk of the issuer user will be used if not provided
 * - content (optional)
 * - uniqueName, for the badge definition
 * - shortName, for the badge definition
 * Returns array of tuples for each of the configured relays containing information whether the connection to the relay
 * and the event creation were successful.
 */
server.post('/badge-definition', checkRelays, createBadgeDefinition)

/**
 * Returns list of badge definition events created by the pk provided as path variable.
 */
server.get('/badge-definition/:pk', checkRelays, cache(CACHE_DURATION), getBadgeDefinitions)


/**
 * Awards a badge to the provided pk.
 * Expects json body with following properties:
 * - sk (optional), the sk of the issuer user will be used if not provided
 * - content (optional)
 * - awardPk, the pk of the receiver of the badge
 * - badgeId, the id of the badge (definition) to be awarded
 * Returns array of tuples for each of the configured relays containing information whether the connection to the relay
 * and the event creation were successful.
 */
server.post('/badge-award', checkRelays, awardBadgeToPubkey)

/**
 * Returns list of badge award events awarded to the pk provided as path variable.
 * The event models are extended to contain boolean property indicating whether the badge was accepted by the pk.
 */
server.get('/badge-award/:pk', checkRelays, cache(CACHE_DURATION), getBadgesAwardedToPubkey)

/**
 * Returns list of badge award events awarded and accepted by the pk provided as path variable.
 */
server.get('/badge-accepted/:pk', checkRelays, cache(CACHE_DURATION), getBadgesAcceptedByPubkey)

/**
 * Returns list of badge award events awarded to any pk.
 * The event models are extended to contain boolean property indicating whether the badge was accepted by the receiver.
 * Accepts numeric query parameters since and until, to only fetch subset of the data.
 * Since and until are integer unix timestamps.
 */
server.get('/badge-award', checkRelays, cache(CACHE_DURATION), getAllBadgesGiven)

/**
 * Returns list of badge award events awarded and accepted by any pk.
 * Accepts numeric query parameters since and until, to only fetch subset of the data.
 * Since and until are integer unix timestamps.
 */
server.get('/badge-accepted', checkRelays, cache(CACHE_DURATION), getAllBadgesAccepted)


/**
 * Creates a profile badges event.
 * Expects json body with following properties:
 * - sk (optional), the sk of the receiver user will be used if not provided
 * - content (optional)
 * - awardIds, the ids of the award badge events to be accepted
 * Returns array of tuples for each of the configured relays containing information whether the connection to the relay
 * and the event creation were successful.
 */
server.post('/badge-profile', checkRelays, createBadgeProfile)

server.listen(port, hostname, () => {
    console.log('Server started listening.')
})