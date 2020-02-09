require('dotenv').config()
const { GraphQLClient } = require('graphql-request')
const logger = require('../services/logger')

const {
  GRAPH_URL,
  DAI_POINTS_COMMUNITY_ADDRESS
} = process.env

const graphClient = new GraphQLClient(GRAPH_URL)

const getCommunityMembers = async (getCount) => {
  logger.info('getCommunityMembers')
  const query = `{communities(where:{address:"${DAI_POINTS_COMMUNITY_ADDRESS}"}) {entitiesList {communityEntities(where:{isUser: true, isAdmin: false}) {id, address}}}}`
  logger.debug(`query: ${query.replace('\n', '')}`)
  const data = await graphClient.request(query)
  const communityMembers = data.communities[0].entitiesList.communityEntities
  logger.debug(`found ${communityMembers.length} users`)
  return (getCount ? communityMembers.length : communityMembers)
}

module.exports = {
  getCommunityMembers
}
