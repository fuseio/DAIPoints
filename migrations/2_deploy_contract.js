require('dotenv').config()

const DAIPointsToken = artifacts.require('./DAIPointsToken.sol')

const { DAI_ADDRESS } = process.env

module.exports = (deployer) => {
  deployer.then(async function() {
    let daiPointsToken = await DAIPointsToken.new(DAI_ADDRESS)
    console.log(`DAIPointsToken: ${daiPointsToken.address}`)
  }).catch(function(error) {
    console.error(error)
  })
}
