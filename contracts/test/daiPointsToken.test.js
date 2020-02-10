const { ERROR_MSG, ZERO_ADDRESS, RANDOM_ADDRESS } = require('./helpers')
const {toBN, toWei, fromWei, toChecksumAddress} = web3.utils

const DAIMock = artifacts.require('DAIMock.sol')
const CErc20Mock = artifacts.require('CErc20Mock.sol')
const BridgeMock = artifacts.require('BridgeMock.sol')
const DAIPointsToken = artifacts.require('DAIPointsToken.sol')

const DECIMALS = toBN(1e18)

contract('DAIPointsToken', (accounts) => {
  let owner = accounts[0]
  let notOwner = accounts[1]
  let alice = accounts[2]
  let bob = accounts[3]
  let dai
  let compound
  let daip
  let bridge
  let exchangeRateMantissa = toBN(2e16).add(DECIMALS) // 2%

  beforeEach(async () => {
    dai = await DAIMock.new()
    compound = await CErc20Mock.new()
    await compound.initialize(dai.address, exchangeRateMantissa)
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
      let newCompound = await CErc20Mock.new()
      await newCompound.initialize(dai.address, exchangeRateMantissa)

      await daip.setCompound(newCompound.address, {from: notOwner}).should.be.rejectedWith(ERROR_MSG)
      compound.address.should.be.equal(await daip.compound())

      await daip.setCompound(newCompound.address, {from: owner}).should.be.fulfilled
      newCompound.address.should.be.equal(await daip.compound())
    })

    it('should set bridge address', async () => {
      let bridge = await BridgeMock.new()
      await bridge.initialize(daip.address)

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
      let amount = toBN(toWei('1', 'ether'))

      await daip.mint(alice, amount, {from: notOwner}).should.be.rejectedWith(ERROR_MSG)
      toBN(0).should.be.bignumber.equal(await daip.balanceOf(alice))

      await daip.mint(alice, amount, {from: owner}).should.be.fulfilled
      amount.should.be.bignumber.equal(await daip.balanceOf(alice))
    })
  })

  describe('functionality', () => {
    beforeEach(async () => {
      bridge = await BridgeMock.new()
      await bridge.initialize(daip.address)
      await daip.setBridge(bridge.address, {from: owner}).should.be.fulfilled
    })

    it('getDAIPoints', async () => {
      let rate = await daip.daiToDaipConversionRate()
      let daiAmount = toBN(toWei('1', 'ether'))
      let daipAmount = daiAmount.mul(rate)

      // alice gets DAI
      await dai.mint(alice, daiAmount)
      daiAmount.should.be.bignumber.equal(await dai.balanceOf(alice))

      // alice tries to get DAIPoints (should fail because not approved before)
      await daip.getDAIPoints(daiAmount, {from: alice}).should.be.rejectedWith(ERROR_MSG)
      toBN(0).should.be.bignumber.equal(await dai.balanceOf(daip.address))

      // alice approves DAI to DAIPoints address
      await dai.approve(daip.address, daiAmount, {from: alice})

      // flow
      await daip.getDAIPoints(daiAmount, {from: alice}).should.be.fulfilled
      toBN(0).should.be.bignumber.equal(await dai.balanceOf(alice))
      toBN(0).should.be.bignumber.equal(await dai.balanceOf(daip.address))
      daipAmount.should.be.bignumber.equal(await daip.totalSupply())
      daipAmount.should.be.bignumber.equal(await daip.balanceOf(bridge.address))
      daip.address.should.be.equal(await bridge.from())
      daipAmount.should.be.bignumber.equal(await bridge.value())
      toChecksumAddress(alice).should.be.equal(toChecksumAddress(await bridge.data()))
      daiAmount.should.be.bignumber.equal(await compound.balanceOfUnderlying(daip.address))
    })

    it('getDAIPointsToAddress', async () => {
      let rate = await daip.daiToDaipConversionRate()
      let daiAmount = toBN(toWei('1', 'ether'))
      let daipAmount = daiAmount.mul(rate)

      // alice gets DAI
      await dai.mint(alice, daiAmount)
      daiAmount.should.be.bignumber.equal(await dai.balanceOf(alice))

      // alice tries to get DAIPoints (should fail because not approved before)
      await daip.getDAIPointsToAddress(daiAmount, bob, {from: alice}).should.be.rejectedWith(ERROR_MSG)
      toBN(0).should.be.bignumber.equal(await dai.balanceOf(daip.address))

      // alice approves DAI to DAIPoints address
      await dai.approve(daip.address, daiAmount, {from: alice})

      // flow
      await daip.getDAIPointsToAddress(daiAmount, bob, {from: alice}).should.be.fulfilled
      toBN(0).should.be.bignumber.equal(await dai.balanceOf(alice))
      toBN(0).should.be.bignumber.equal(await dai.balanceOf(daip.address))
      daipAmount.should.be.bignumber.equal(await daip.totalSupply())
      daipAmount.should.be.bignumber.equal(await daip.balanceOf(bridge.address))
      daip.address.should.be.equal(await bridge.from())
      daipAmount.should.be.bignumber.equal(await bridge.value())
      toChecksumAddress(bob).should.be.equal(toChecksumAddress(await bridge.data()))
      daiAmount.should.be.bignumber.equal(await compound.balanceOfUnderlying(daip.address))
    })

    it('transfer', async () => {
      let rate = await daip.daiToDaipConversionRate()
      let daiAmount = toBN(toWei('1', 'ether'))
      let daipAmount = daiAmount.mul(rate)

      // alice gets DAI
      await dai.mint(alice, daiAmount)

      // alice approves DIA to DAIPoints address
      await dai.approve(daip.address, daiAmount, {from: alice})

      // alice gets DAIPoints
      await daip.getDAIPoints(daiAmount, {from: alice}).should.be.fulfilled

      // flow
      await bridge.onExecuteMessage(alice, daipAmount).should.be.fulfilled // calls DAIPoints.transfer internally
      daiAmount.should.be.bignumber.equal(await dai.balanceOf(alice))
      toBN(0).should.be.bignumber.equal(await dai.balanceOf(daip.address))
      toBN(0).should.be.bignumber.equal(await daip.totalSupply())
      toBN(0).should.be.bignumber.equal(await daip.balanceOf(bridge.address))
      toBN(0).should.be.bignumber.equal(await compound.balanceOfUnderlying(daip.address))
    })

    it('reward (without fee)', async () => {
      let rate = await daip.daiToDaipConversionRate()
      let daiAmountAlice = toBN(toWei('1', 'ether'))
      let daipAmountAlice = daiAmountAlice.mul(rate)
      let daiAmountBob = toBN(toWei('2', 'ether'))
      let daipAmountBob = daiAmountBob.mul(rate)

      // console.log({alice, bob})

      // alice gets DAI
      await dai.mint(alice, daiAmountAlice)

      // alice approves DIA to DAIPoints address
      await dai.approve(daip.address, daiAmountAlice, {from: alice})

      // alice gets DAIPoints
      await daip.getDAIPoints(daiAmountAlice, {from: alice}).should.be.fulfilled

      // bob gets DAI
      await dai.mint(bob, daiAmountBob)

      // bob approves DIA to DAIPoints address
      await dai.approve(daip.address, daiAmountBob, {from: bob})

      // bob gets DAIPoints
      await daip.getDAIPoints(daiAmountBob, {from: bob}).should.be.fulfilled

      // pick a winner and simulate reward

      let winner = (Math.floor(Math.random() * 2) + 1) % 2 === 0 ? alice : bob
      // console.log({winner})

      let compoundBalance = await compound.balanceOfUnderlying(daip.address)
      // console.log('compoundBalance', fromWei(compoundBalance))

      let compoundValue = compoundBalance.mul(exchangeRateMantissa).div(DECIMALS)
      // console.log('compoundValue', fromWei(compoundValue))

      let daipTotalSupply = await daip.totalSupply()
      // console.log('daipTotalSupply', fromWei(daipTotalSupply))

      let daipTotalSupplyInDai = daipTotalSupply.div(rate)
      // console.log('daipTotalSupplyInDai', fromWei(daipTotalSupplyInDai))

      let grossWinnings = compoundValue.sub(daipTotalSupplyInDai)
      // console.log('grossWinnings', fromWei(grossWinnings))

      let daipReward = grossWinnings.mul(rate)
      // console.log('daipReward', fromWei(daipReward))

      let daipExpectedTotalSupply = daipTotalSupply.add(daipReward)
      // console.log('daipExpectedTotalSupply', fromWei(daipExpectedTotalSupply))

      // flow
      await daip.reward(winner).should.be.fulfilled
      daipExpectedTotalSupply.should.be.bignumber.equal(await daip.totalSupply())
      daipExpectedTotalSupply.should.be.bignumber.equal(await daip.balanceOf(bridge.address))
      daip.address.should.be.equal(await bridge.from())
      daipReward.should.be.bignumber.equal(await bridge.value())
      toChecksumAddress(winner).should.be.equal(toChecksumAddress(await bridge.data()))
    })

    it('reward (with fee)', async () => {
      let rate = await daip.daiToDaipConversionRate()
      let daiAmountAlice = toBN(toWei('1', 'ether'))
      let daipAmountAlice = daiAmountAlice.mul(rate)
      let daiAmountBob = toBN(toWei('2', 'ether'))
      let daipAmountBob = daiAmountBob.mul(rate)

      // set fee
      let fee = toBN(1e17) // 10%
      await daip.setFee(fee, {from: owner}).should.be.fulfilled

      // console.log({alice, bob})

      // alice gets DAI
      await dai.mint(alice, daiAmountAlice)

      // alice approves DIA to DAIPoints address
      await dai.approve(daip.address, daiAmountAlice, {from: alice})

      // alice gets DAIPoints
      await daip.getDAIPoints(daiAmountAlice, {from: alice}).should.be.fulfilled

      // bob gets DAI
      await dai.mint(bob, daiAmountBob)

      // bob approves DIA to DAIPoints address
      await dai.approve(daip.address, daiAmountBob, {from: bob})

      // bob gets DAIPoints
      await daip.getDAIPoints(daiAmountBob, {from: bob}).should.be.fulfilled

      // pick a winner and simulate reward
      let winner = (Math.floor(Math.random() * 2) + 1) % 2 === 0 ? alice : bob
      // console.log({winner})

      let compoundBalance = await compound.balanceOfUnderlying(daip.address)
      // console.log('compoundBalance', fromWei(compoundBalance))

      let compoundValue = compoundBalance.mul(exchangeRateMantissa).div(DECIMALS)
      // console.log('compoundValue', fromWei(compoundValue))

      let daipTotalSupply = await daip.totalSupply()
      // console.log('daipTotalSupply', fromWei(daipTotalSupply))

      let daipTotalSupplyInDai = daipTotalSupply.div(rate)
      // console.log('daipTotalSupplyInDai', fromWei(daipTotalSupplyInDai))

      let grossWinnings = compoundValue.sub(daipTotalSupplyInDai)
      // console.log('grossWinnings', fromWei(grossWinnings))

      let rewardAmount = grossWinnings.mul(DECIMALS.sub(fee)).div(DECIMALS)
      // console.log('rewardAmount', fromWei(rewardAmount))

      let feeAmount = grossWinnings.sub(rewardAmount)
      // console.log('feeAmount', fromWei(feeAmount))

      let daipReward = rewardAmount.mul(rate)
      // console.log('daipReward', fromWei(daipReward))

      let daipExpectedTotalSupply = daipTotalSupply.add(daipReward)
      // console.log('daipExpectedTotalSupply', fromWei(daipExpectedTotalSupply))

      // flow
      await daip.reward(winner).should.be.fulfilled
      daipExpectedTotalSupply.should.be.bignumber.equal(await daip.totalSupply())
      daipExpectedTotalSupply.should.be.bignumber.equal(await daip.balanceOf(bridge.address))
      daip.address.should.be.equal(await bridge.from())
      daipReward.should.be.bignumber.equal(await bridge.value())
      toChecksumAddress(winner).should.be.equal(toChecksumAddress(await bridge.data()))
      feeAmount.should.be.bignumber.equal(await dai.balanceOf(owner))
    })
  })
})
