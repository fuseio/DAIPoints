require('dotenv').config()
const { GraphQLClient } = require('graphql-request')
const logger = require('../services/logger')
const { getWalletsByPhoneNumber, getWalletByAddress } = require('./api')

const {
  GRAPH_URL,
  DAI_POINTS_COMMUNITY_ADDRESS,
  EXCLUDED_PHONE_NUMBERS
} = process.env

const graphClient = new GraphQLClient(GRAPH_URL)

const getCommunityMembers = async (getCount) => {
  const getExcludedWallets = async () => {
    const excludedPhoneNumbers = EXCLUDED_PHONE_NUMBERS.split(',')
    logger.debug({ excludedPhoneNumbers })
    const promises = excludedPhoneNumbers.map(phoneNumber => { return getWalletsByPhoneNumber(phoneNumber) })
    const resolved = await Promise.all(promises)
    // logger.debug({ resolved })
    const results = [].concat.apply([], resolved)
    logger.debug({ results })
    const wallets = results.filter(obj => obj).map(obj => obj.toLowerCase())
    return wallets.length ? wallets : ['']
  }

  const filterDeletedWallets = async (communityMembers) => {
    const addresses = communityMembers.map(cm => cm.address)
    const promises = addresses.map(address => { return getWalletByAddress(address) })
    const resolved = await Promise.all(promises)
    // logger.debug({ resolved })
    const results = resolved.filter(obj => obj)
    // logger.debug({ results })
    return results.map(obj => obj.walletAddress)
  }

  logger.info('getCommunityMembers')
  const excludedWallets = await getExcludedWallets()
  logger.debug({ excludedWallets })
  const query = `{communities(where:{address:"${DAI_POINTS_COMMUNITY_ADDRESS}"}) {entitiesList {communityEntities(where:{isUser: true, isAdmin: false, address_not_in: ${JSON.stringify(excludedWallets)}}) {id, address}}}}`
  logger.debug(`query: ${query.replace('\n', '')}`)
  const data = await graphClient.request(query)
  let communityMembers = []
  if (data && data.communities && data.communities.length) {
    communityMembers = data.communities[0].entitiesList.communityEntities
    logger.debug(`found ${communityMembers.length} users`)
  }
  communityMembers = await filterDeletedWallets(communityMembers)
  logger.debug(`found ${communityMembers.length} users after filtering deleted wallets`)
  return (getCount ? communityMembers.length : communityMembers)
}

module.exports = {
  getCommunityMembers
}
