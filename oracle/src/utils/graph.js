require('dotenv').config()
const Promise = require('bluebird')
const { GraphQLClient } = require('graphql-request')
const logger = require('../services/logger')
const cache = require('../services/cache')
const { getWalletsByPhoneNumber, isExistWalletByAddress } = require('./api')
const { toBN, DECIMALS } = require('./web3')

const {
  GRAPH_URL,
  DAI_POINTS_COMMUNITY_ADDRESS,
  HOME_DAI_POINTS_ADDRESS,
  EXCLUDED_PHONE_NUMBERS
} = process.env

const graphClient = new GraphQLClient(GRAPH_URL)

const getCommunityMembers = async (getCount) => {
  const getExcludedWallets = async () => {
    const excludedPhoneNumbers = EXCLUDED_PHONE_NUMBERS.split(',')
    logger.debug({ excludedPhoneNumbers })
    const promises = excludedPhoneNumbers.map(phoneNumber => { return getWalletsByPhoneNumber(phoneNumber) })
    const resolved = await Promise.all(promises)
    const results = [].concat.apply([], resolved)
    const wallets = results.filter(obj => obj).map(obj => obj.toLowerCase())
    return wallets.length ? wallets : ['']
  }

  const filterDeletedWallets = async (communityMembers) => {
    const results = await Promise.map(communityMembers, cm => {
      return new Promise(resolve => {
        isExistWalletByAddress(cm.address)
          .then(result => {
            resolve(result)
          })
      })
    }, { concurrency: 100 }).filter(obj => obj.exists).map(obj => obj.address)
    return results.length ? results : []
  }

  const getCommunityMembersQuery = async (excludedWallets, limit, offset) => {
    const query = `{communities(where:{address:"${DAI_POINTS_COMMUNITY_ADDRESS}"}) {entitiesList {communityEntities(skip: ${offset}, first: ${limit}, where:{isUser: true, isAdmin: false, address_not_in: ${JSON.stringify(excludedWallets)}}) {id, address}}}}`
    logger.trace(`query: ${query.replace('\n', '')}`)
    return graphClient.request(query)
  }

  logger.info('getCommunityMembers')
  let communityMembers = cache.get('communityMembers')
  if (communityMembers) {
    logger.debug(`found ${communityMembers.length} users from cache`)
    return (getCount ? communityMembers.length : communityMembers)
  }
  communityMembers = []
  const excludedWallets = await getExcludedWallets()
  logger.trace({ excludedWallets })
  const limit = 1000
  let offset = 0
  let data = await getCommunityMembersQuery(excludedWallets, limit, offset)
  while (data && data.communities && data.communities && data.communities[0] && data.communities[0].entitiesList && data.communities[0].entitiesList.communityEntities && data.communities[0].entitiesList.communityEntities.length) {
    communityMembers = communityMembers.concat(data.communities[0].entitiesList.communityEntities)
    offset += limit
    data = await getCommunityMembersQuery(excludedWallets, limit, offset)
  }
  logger.debug(`found ${communityMembers.length} users`)
  communityMembers = await filterDeletedWallets(communityMembers)
  logger.debug(`found ${communityMembers.length} users after filtering deleted wallets`)
  return (getCount ? communityMembers.length : communityMembers)
}

const getCommunityMembersWithBalances = async () => {
  const getBalanceQuery = async (address) => {
    const query = `{accountTokens(where:{account:"${address}", tokenAddress:"${HOME_DAI_POINTS_ADDRESS}"}) {account {id, address}, balance}}`
    logger.trace(`query: ${query.replace('\n', '')}`)
    const result = await graphClient.request(query)
    if (result && result.accountTokens && result.accountTokens[0] && result.accountTokens[0].balance) {
      return { address, balance: toBN(result.accountTokens[0].balance).div(DECIMALS).toNumber() }
    } else {
      return { address, balance: 0 }
    }
  }
  logger.info('getTokenBalances')
  const communityMembers = await getCommunityMembers()
  logger.trace({ communityMembers })
  const results = await Promise.map(communityMembers, address => {
    return new Promise(resolve => {
      getBalanceQuery(address)
        .then(result => {
          resolve(result)
        })
    })
  }, { concurrency: 100 }).filter(obj => obj.balance)
  return results
}

module.exports = {
  getCommunityMembers,
  getCommunityMembersWithBalances
}
