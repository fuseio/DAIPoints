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
  let daip

  beforeEach(async () => {
    dai = await DAIMock.new()
    daip = await DAIPointsToken.new(dai.address)
  })

  describe('construction', () => {
    it('should have correct name', async () => {
      'DAIPoints'.should.be.equal(await daip.name())
    })

    it('should have correct symbol', async () => {
      'DAIp'.should.be.equal(await daip.symbol())
    })

    it('should have correct total supply', async () => {
      toBN(0).should.be.bignumber.equal(await daip.totalSupply())
    })

    it('should have correct owner', async () => {
      owner.should.be.equal(await daip.owner())
    })

    it('should have correct dai address', async () => {
      dai.address.should.be.equal(await daip.DAI())
    })

    it('should have correct dai to daip conversion rate', async () => {
      toBN(100).should.be.bignumber.equal(await daip.DAI_TO_DAIPOINTS_CONVERSION_RATE())
    })
  })

  describe('onlyOwner', () => {
    it('should set dai address', async () => {
      let newDai = await DAIMock.new()

      await daip.setDAI(newDai.address, {from: notOwner}).should.be.rejectedWith(ERROR_MSG)
      dai.address.should.be.equal(await daip.DAI())

      await daip.setDAI(newDai.address, {from: owner}).should.be.fulfilled
      newDai.address.should.be.equal(await daip.DAI())
    })

    it('should set dai to daip conversion rate', async () => {
      let newRate = 50

      await daip.setConversionRate(newRate, {from: notOwner}).should.be.rejectedWith(ERROR_MSG)
      toBN(100).should.be.bignumber.equal(await daip.DAI_TO_DAIPOINTS_CONVERSION_RATE())

      await daip.setConversionRate(newRate, {from: owner}).should.be.fulfilled
      toBN(newRate).should.be.bignumber.equal(await daip.DAI_TO_DAIPOINTS_CONVERSION_RATE())
    })

    it('should mint daip (without transferring dai)', async () => {
      let amount = toWei(toBN(100000000000000000), 'gwei') // 1

      await daip.mint(alice, amount, {from: notOwner}).should.be.rejectedWith(ERROR_MSG)
      toBN(0).should.be.bignumber.equal(await daip.balanceOf(alice))

      await daip.mint(alice, amount, {from: owner}).should.be.fulfilled
      amount.should.be.bignumber.equal(await daip.balanceOf(alice))
    })

    it('should transfer dai', async () => {
      let amount = toWei(toBN(100000000000000000), 'gwei') // 1

      await dai.mint(daip.address, amount)
      amount.should.be.bignumber.equal(await dai.balanceOf(daip.address))

      await daip.moveDAI(alice, amount, {from: notOwner}).should.be.rejectedWith(ERROR_MSG)
      toBN(0).should.be.bignumber.equal(await dai.balanceOf(alice))

      await daip.moveDAI(alice, amount, {from: owner}).should.be.fulfilled
      amount.should.be.bignumber.equal(await dai.balanceOf(alice))
      toBN(0).should.be.bignumber.equal(await dai.balanceOf(daip.address))
    })
  })

  describe('DAI <> DAIPoints', () => {
    it('should work', async () => {
      let rate = await daip.DAI_TO_DAIPOINTS_CONVERSION_RATE()
      let daiAmount = toWei(toBN(100000000000000000), 'gwei') // 1
      let daipAmount = daiAmount.mul(rate)
      let daipAmountToTransfer = daipAmount.div(toBN(2))
      let daiAmountAfterTransfer = daipAmountToTransfer.div(rate)

      // alice gets dai
      await dai.mint(alice, daiAmount)
      daiAmount.should.be.bignumber.equal(await dai.balanceOf(alice))

      // alice tries to get daip (should fail because not approved before)
      await daip.getDAIPoints(daiAmount, {from: alice}).should.be.rejectedWith(ERROR_MSG)
      toBN(0).should.be.bignumber.equal(await dai.balanceOf(daip.address))

      // alice approves dai to daip address
      await dai.approve(daip.address, daiAmount, {from: alice})

      // alice gets daip in exchange for dai
      await daip.getDAIPoints(daiAmount, {from: alice}).should.be.fulfilled
      toBN(0).should.be.bignumber.equal(await dai.balanceOf(alice))
      daiAmount.should.be.bignumber.equal(await dai.balanceOf(daip.address))
      daipAmount.should.be.bignumber.equal(await daip.balanceOf(alice))

      // alice sends some daip to bob
      await daip.transfer(bob, daipAmountToTransfer, {from: alice}).should.be.fulfilled
      daipAmountToTransfer.should.be.bignumber.equal(await daip.balanceOf(alice))
      daipAmountToTransfer.should.be.bignumber.equal(await daip.balanceOf(bob))

      // bob gets dai in exchange for daip
      await daip.getDAI(daipAmountToTransfer, {from: bob}).should.be.fulfilled
      daiAmountAfterTransfer.should.be.bignumber.equal(await dai.balanceOf(bob))
      daiAmountAfterTransfer.should.be.bignumber.equal(await dai.balanceOf(daip.address))
      toBN(0).should.be.bignumber.equal(await daip.balanceOf(bob))
    })
  })
})
