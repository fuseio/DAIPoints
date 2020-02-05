const { ERROR_MSG, ZERO_ADDRESS, RANDOM_ADDRESS } = require('./helpers')
const {toBN, toWei} = web3.utils

const DAIMock = artifacts.require('DAIMock.sol')
const CErc20Mock = artifacts.require('CErc20Mock.sol')
const BridgeMock = artifacts.require('BridgeMock.sol')
const DAIPointsToken = artifacts.require('DAIPointsToken.sol')

contract('DAIPointsToken', (accounts) => {
  let owner = accounts[0]
  let notOwner = accounts[1]
  let alice = accounts[2]
  let bob = accounts[3]
  let dai
  let compound
  let daip

  beforeEach(async () => {
    dai = await DAIMock.new()
    compound = await CErc20Mock.new(dai.address, 0.02)
    daip = await DAIPointsToken.new(dai.address, compound.address)
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
      dai.address.should.be.equal(await daip.dai())
    })

    it('should have correct compound address', async () => {
      compound.address.should.be.equal(await daip.compound())
    })

    it('should have correct bridge address', async () => {
      ZERO_ADDRESS.should.be.equal(await daip.bridge())
    })

    it('should have correct dai to daip conversion rate', async () => {
      toBN(100).should.be.bignumber.equal(await daip.daiToDaipConversionRate())
    })

    it('should have correct fee amount', async () => {
      toBN(0).should.be.bignumber.equal(await daip.fee())
    })
  })

  describe('onlyOwner', () => {
    it('should set dai address', async () => {
      let newDai = await DAIMock.new()

      await daip.setDAI(newDai.address, {from: notOwner}).should.be.rejectedWith(ERROR_MSG)
      dai.address.should.be.equal(await daip.dai())

      await daip.setDAI(newDai.address, {from: owner}).should.be.fulfilled
      newDai.address.should.be.equal(await daip.dai())
    })

    it('should set compound address', async () => {
      let newCompound = await CErc20Mock.new(dai.address, 0.02)

      await daip.setCompound(newCompound.address, {from: notOwner}).should.be.rejectedWith(ERROR_MSG)
      compound.address.should.be.equal(await daip.compound())

      await daip.setCompound(newCompound.address, {from: owner}).should.be.fulfilled
      newCompound.address.should.be.equal(await daip.compound())
    })

    it('should set bridge address', async () => {
      let bridge = await BridgeMock.new()

      await daip.setBridge(bridge.address, {from: notOwner}).should.be.rejectedWith(ERROR_MSG)
      ZERO_ADDRESS.should.be.equal(await daip.bridge())

      await daip.setBridge(bridge.address, {from: owner}).should.be.fulfilled
      bridge.address.should.be.equal(await daip.bridge())
    })

    it('should set dai to daip conversion rate', async () => {
      let newRate = 50

      await daip.setConversionRate(newRate, {from: notOwner}).should.be.rejectedWith(ERROR_MSG)
      toBN(100).should.be.bignumber.equal(await daip.daiToDaipConversionRate())

      await daip.setConversionRate(newRate, {from: owner}).should.be.fulfilled
      toBN(newRate).should.be.bignumber.equal(await daip.daiToDaipConversionRate())
    })

    it('should set fee amount', async () => {
      let fee = toBN(1e17) // 10%

      await daip.setFee(fee, {from: notOwner}).should.be.rejectedWith(ERROR_MSG)
      toBN(0).should.be.bignumber.equal(await daip.fee())

      await daip.setFee(fee, {from: owner}).should.be.fulfilled
      fee.should.be.bignumber.equal(await daip.fee())
    })

    it('should mint daip (without transferring dai)', async () => {
      let amount = toWei('1', 'ether')

      await daip.mint(alice, amount, {from: notOwner}).should.be.rejectedWith(ERROR_MSG)
      toBN(0).should.be.bignumber.equal(await daip.balanceOf(alice))

      await daip.mint(alice, amount, {from: owner}).should.be.fulfilled
      amount.should.be.bignumber.equal(await daip.balanceOf(alice))
    })
  })

  describe('getDAIPoints', () => {
    // TODO
  })

  describe('transfer', () => {
    // TODO
  })

  describe('reward', () => {
    // TODO
  })

  // describe('DAI <> DAIPoints', () => {
  //   it('should work', async () => {
  //     let rate = await daip.daiToDaipConversionRate()
  //     let daiAmount = toWei(toBN(100000000000000000), 'gwei') // 1
  //     let daipAmount = daiAmount.mul(rate)
  //     let daipAmountToTransfer = daipAmount.div(toBN(2))
  //     let daiAmountAfterTransfer = daipAmountToTransfer.div(rate)

  //     // alice gets dai
  //     await dai.mint(alice, daiAmount)
  //     daiAmount.should.be.bignumber.equal(await dai.balanceOf(alice))

  //     // alice tries to get daip (should fail because not approved before)
  //     await daip.getDAIPoints(daiAmount, {from: alice}).should.be.rejectedWith(ERROR_MSG)
  //     toBN(0).should.be.bignumber.equal(await dai.balanceOf(daip.address))

  //     // alice approves dai to daip address
  //     await dai.approve(daip.address, daiAmount, {from: alice})

  //     // alice gets daip in exchange for dai
  //     await daip.getDAIPoints(daiAmount, {from: alice}).should.be.fulfilled
  //     toBN(0).should.be.bignumber.equal(await dai.balanceOf(alice))
  //     daiAmount.should.be.bignumber.equal(await dai.balanceOf(daip.address))
  //     daipAmount.should.be.bignumber.equal(await daip.balanceOf(alice))

  //     // alice sends some daip to bob
  //     await daip.transfer(bob, daipAmountToTransfer, {from: alice}).should.be.fulfilled
  //     daipAmountToTransfer.should.be.bignumber.equal(await daip.balanceOf(alice))
  //     daipAmountToTransfer.should.be.bignumber.equal(await daip.balanceOf(bob))

  //     // bob gets dai in exchange for daip
  //     await daip.getDAI(daipAmountToTransfer, {from: bob}).should.be.fulfilled
  //     daiAmountAfterTransfer.should.be.bignumber.equal(await dai.balanceOf(bob))
  //     daiAmountAfterTransfer.should.be.bignumber.equal(await dai.balanceOf(daip.address))
  //     toBN(0).should.be.bignumber.equal(await daip.balanceOf(bob))
  //   })
  // })
})
