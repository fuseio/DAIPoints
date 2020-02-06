require('dotenv').config()
const { GraphQLClient } = require('graphql-request')

const {
  GRAPH_URL,
  DAI_POINTS_COMMUNITY_ADDRESS
} = process.env

const graphClient = new GraphQLClient(GRAPH_URL)

const main = async () => {
  const query = `{communities(where:{address:"${DAI_POINTS_COMMUNITY_ADDRESS}"}) {entitiesList {communityEntities(where:{isUser: true, isAdmin: false}) {id, address}}}}`
  console.log(`query: ${query.replace('\n', '')}`)
  const data = await graphClient.request(query)
  const communityUsers = data.communities[0].entitiesList.communityEntities
  console.log(`found ${communityUsers.length} users`)
  const winner = communityUsers[(Math.floor(Math.random() * communityUsers.length - 1) + 1)]
  console.log(`winner is: ${winner.address}`)
}

main()
