require('dotenv').config()

const DAIPointsToken = artifacts.require('./DAIPointsToken.sol')

const { DAI_ADDRESS, COMPOUND_ADDRESS } = process.env

module.exports = (deployer, network, accounts) => {
  if (network !== 'test') {
    deployer.then(async function() {
      let daiPointsToken = await DAIPointsToken.new(DAI_ADDRESS, COMPOUND_ADDRESS)
      console.log(`DAIPointsToken: ${daiPointsToken.address}`)
    }).catch(function(error) {
      console.error(error)
    })
  }
}
