const { ERROR_MSG, RANDOM_ADDRESS } = require('./helpers')
const {toBN, toWei} = web3.utils

const DAIMock = artifacts.require('DAIMock.sol')
const DAIPointsToken = artifacts.require('DAIPointsToken.sol')

contract('DAIPointsToken', (accounts) => {
  let owner = accounts[0]
  let notOwner = accounts[1]
  let alice = accounts[2]
  let bob = accounts[3]
  let dai
  let dpts

  beforeEach(async () => {
    dai = await DAIMock.new()
    dpts = await DAIPointsToken.new(dai.address)
  })

  describe('construction', () => {
    it('should have correct name', async () => {
      'DAIPoints'.should.be.equal(await dpts.name())
    })

    it('should have correct symbol', async () => {
      'DPTS'.should.be.equal(await dpts.symbol())
    })

    it('should have correct total supply', async () => {
      toBN(0).should.be.bignumber.equal(await dpts.totalSupply())
    })

    it('should have correct owner', async () => {
      owner.should.be.equal(await dpts.owner())
    })

    it('should have correct dai address', async () => {
      dai.address.should.be.equal(await dpts.DAI())
    })

    it('should have correct dai to dpts conversion rate', async () => {
      toBN(100).should.be.bignumber.equal(await dpts.DAI_TO_DAIPOINTS_CONVERSION_RATE())
    })
  })

  describe('onlyOwner', () => {
    it('should set dai address', async () => {
      let newDai = await DAIMock.new()

      await dpts.setDAI(newDai.address, {from: notOwner}).should.be.rejectedWith(ERROR_MSG)
      dai.address.should.be.equal(await dpts.DAI())

      await dpts.setDAI(newDai.address, {from: owner}).should.be.fulfilled
      newDai.address.should.be.equal(await dpts.DAI())
    })

    it('should set dai to dpts conversion rate', async () => {
      let newRate = 50

      await dpts.setConversionRate(newRate, {from: notOwner}).should.be.rejectedWith(ERROR_MSG)
      toBN(100).should.be.bignumber.equal(await dpts.DAI_TO_DAIPOINTS_CONVERSION_RATE())

      await dpts.setConversionRate(newRate, {from: owner}).should.be.fulfilled
      toBN(newRate).should.be.bignumber.equal(await dpts.DAI_TO_DAIPOINTS_CONVERSION_RATE())
    })

    it('should mint dpts (without transferring dai)', async () => {
      let amount = toWei(toBN(100000000000000000), 'gwei') // 1

      await dpts.mint(alice, amount, {from: notOwner}).should.be.rejectedWith(ERROR_MSG)
      toBN(0).should.be.bignumber.equal(await dpts.balanceOf(alice))

      await dpts.mint(alice, amount, {from: owner}).should.be.fulfilled
      amount.should.be.bignumber.equal(await dpts.balanceOf(alice))
    })

    it('should transfer dai', async () => {
      let amount = toWei(toBN(100000000000000000), 'gwei') // 1

      await dai.mint(dpts.address, amount)
      amount.should.be.bignumber.equal(await dai.balanceOf(dpts.address))

      await dpts.moveDAI(alice, amount, {from: notOwner}).should.be.rejectedWith(ERROR_MSG)
      toBN(0).should.be.bignumber.equal(await dai.balanceOf(alice))

      await dpts.moveDAI(alice, amount, {from: owner}).should.be.fulfilled
      amount.should.be.bignumber.equal(await dai.balanceOf(alice))
      toBN(0).should.be.bignumber.equal(await dai.balanceOf(dpts.address))
    })
  })

  describe('DAI <> DAIPoints', () => {
    it('should work', async () => {
      let rate = await dpts.DAI_TO_DAIPOINTS_CONVERSION_RATE()
      let daiAmount = toWei(toBN(100000000000000000), 'gwei') // 1
      let dptsAmount = daiAmount.mul(rate)
      let dptsAmountToTransfer = dptsAmount.div(toBN(2))
      let daiAmountAfterTransfer = dptsAmountToTransfer.div(rate)

      // alice gets dai
      await dai.mint(alice, daiAmount)
      daiAmount.should.be.bignumber.equal(await dai.balanceOf(alice))

      // alice tries to get dpts (should fail because not approved before)
      await dpts.getDAIPoints(daiAmount, {from: alice}).should.be.rejectedWith(ERROR_MSG)
      toBN(0).should.be.bignumber.equal(await dai.balanceOf(dpts.address))

      // alice approves dai to dpts address
      await dai.approve(dpts.address, daiAmount, {from: alice})

      // alice gets dpts in exchange for dai
      await dpts.getDAIPoints(daiAmount, {from: alice}).should.be.fulfilled
      toBN(0).should.be.bignumber.equal(await dai.balanceOf(alice))
      daiAmount.should.be.bignumber.equal(await dai.balanceOf(dpts.address))
      dptsAmount.should.be.bignumber.equal(await dpts.balanceOf(alice))

      // alice sends some dpts to bob
      await dpts.transfer(bob, dptsAmountToTransfer, {from: alice}).should.be.fulfilled
      dptsAmountToTransfer.should.be.bignumber.equal(await dpts.balanceOf(alice))
      dptsAmountToTransfer.should.be.bignumber.equal(await dpts.balanceOf(bob))

      // bob gets dai in exchange for dpts
      await dpts.getDAI(dptsAmountToTransfer, {from: bob}).should.be.fulfilled
      daiAmountAfterTransfer.should.be.bignumber.equal(await dai.balanceOf(bob))
      daiAmountAfterTransfer.should.be.bignumber.equal(await dai.balanceOf(dpts.address))
      toBN(0).should.be.bignumber.equal(await dpts.balanceOf(bob))
    })
  })
})
