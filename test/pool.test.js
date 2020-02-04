const { ERROR_MSG, RANDOM_ADDRESS, ZERO_ADDRESS } = require('./helpers')
const {toBN, toWei} = web3.utils

const DAIMock = artifacts.require('DAIMock.sol')
const DAIPointsToken = artifacts.require('DAIPointsToken.sol')
const Blocklock = artifacts.require('Blocklock.sol')
const SortitionSumTreeFactory = artifacts.require('SortitionSumTreeFactory.sol')
const DrawManager = artifacts.require('DrawManager.sol')
const FixidityLib = artifacts.require('FixidityLib.sol')
const Pool = artifacts.require('Pool.sol')

contract.only('Pool', (accounts) => {
  let admin = accounts[0]
  let notAdmin = accounts[1]
  let alice = accounts[2]
  let bob = accounts[3]
  let dai
  let daip
  let pool

  beforeEach(async () => {
    dai = await DAIMock.new()
    daip = await DAIPointsToken.new(dai.address)

    let sumTree = await SortitionSumTreeFactory.new()
    await DrawManager.link('SortitionSumTreeFactory', sumTree.address)
    let drawManager = await DrawManager.new()

    let fixidity = await FixidityLib.new()
    let blocklock = await Blocklock.new()

    await Pool.link('DrawManager', drawManager.address)
    await Pool.link('FixidityLib', fixidity.address)
    await Pool.link('Blocklock', blocklock.address)
    pool = await Pool.new()
  })

  describe('init', () => {
    it('should fail if no owner', async () => {
      await pool.init(ZERO_ADDRESS, daip.address, 0, pool.address, 120, 120).should.be.rejectedWith(ERROR_MSG)
    })

    it('should fail if no dai points token', async () => {
      await pool.init(admin, ZERO_ADDRESS, 0, pool.address, 120, 120).should.be.rejectedWith(ERROR_MSG)
    })

    it('should fail if no fee beneficiary', async () => {
      await pool.init(admin, daip.address, 0, ZERO_ADDRESS, 120, 120).should.be.rejectedWith(ERROR_MSG)
    })

    it('should fail if lock or cooldown duration is zero', async () => {
      await pool.init(admin, daip.address, 0, pool.address, 0, 120).should.be.rejectedWith(ERROR_MSG)
      await pool.init(admin, daip.address, 0, pool.address, 120, 0).should.be.rejectedWith(ERROR_MSG)
    })

    it('should be successful', async () => {
      await pool.init(admin, daip.address, 0, pool.address, 120, 120).should.be.fulfilled

      true.should.be.equal(await pool.isAdmin(admin))
      daip.address.should.be.equal(await pool.token())
      toBN(0).should.be.bignumber.equal(await pool.nextFeeFraction())
      pool.address.should.be.equal(await pool.nextFeeBeneficiary())
      toBN(120).should.be.bignumber.equal(await pool.lockDuration())
      toBN(120).should.be.bignumber.equal(await pool.cooldownDuration())
    })
  })

  describe('admin', () => {
    beforeEach(async () => {
      await pool.init(admin, daip.address, 0, pool.address, 120, 120).should.be.fulfilled
    })

    describe('addAdmin', () => {
      it('should allow an admin to add another', async () => {
        await pool.addAdmin(alice, {from: admin})
        true.should.be.equal(await pool.isAdmin(alice))
      })

      it('should not allow a non-admin to add an admin', async () => {
        await pool.addAdmin(alice, { from: notAdmin }).should.be.rejectedWith(`${ERROR_MSG} Pool/admin`)
      })
    })

    describe('removeAdmin', () => {
      beforeEach(async () => {
        await pool.addAdmin(alice, {from: admin})
      })

      it('should allow an admin to remove another', async () => {
        await pool.removeAdmin(alice, {from: admin})
        false.should.be.equal(await pool.isAdmin(alice))
      })

      it('should not allow a non-admin to remove an admin', async () => {
        await pool.removeAdmin(alice, { from: notAdmin }).should.be.rejectedWith(`${ERROR_MSG} Pool/admin`)
      })

      it('should not allow to remove a non-admin', async () => {
        await pool.removeAdmin(bob, { from: admin }).should.be.rejectedWith(`${ERROR_MSG} Pool/no-admin`)
      })

      it('should not allow an admin to remove themselves', async () => {
        await pool.removeAdmin(admin, { from: admin }).should.be.rejectedWith(`${ERROR_MSG} Pool/remove-self`)
      })
    })
  })

  describe('committedBalanceOf', () => {
    // TODO
  })

  describe('openBalanceOf', () => {
    // TODO
  })

  describe('getDraw', () => {
    // TODO
  })

  describe('openNextDraw', () => {
    // TODO
  })

  describe('reward', () => {
    // TODO
  })

  describe('rolloverAndOpenNextDraw', () => {
    // TODO
  })

  describe('rollover', () => {
    // TODO
  })

  describe('lockTokens', () => {
    // TODO
  })

  describe('lockDuration', () => {
    // TODO
  })

  describe('lockEndAt', () => {
    // TODO
  })

  describe('cooldownDuration', () => {
    // TODO
  })

  describe('cooldownEndAt', () => {
    // TODO
  })

  describe('unlockTokens', () => {
    // TODO
  })

  describe('rewardAndOpenNextDraw', () => {
    // TODO
  })

  describe('depositPool', () => {
    // TODO
  })

  describe('depositSponsorship', () => {
    // TODO
  })

  describe('withdrawSponsorshipAndFee', () => {
    // TODO
  })

  describe('withdrawOpenDeposit', () => {
    // TODO
  })

  describe('withdrawCommittedDeposit', () => {
    // TODO
  })

  describe('withdraw', () => {
    // TODO
  })

  describe('totalBalanceOf', () => {
    // TODO
  })

  describe('fee fraction is greater than zero', () => {
    // TODO
  })

  describe('pool is rewarded without a winner', () => {
    // TODO
  })

  describe('setNextFeeFraction', () => {
    // TODO
  })

  describe('setNextFeeBeneficiary', () => {
    // TODO
  })

  describe('pauseDeposits', () => {
    // TODO
  })

  describe('unpauseDeposits', () => {
    // TODO
  })

  describe('transferBalanceToSponsorship', () => {
    // TODO
  })
})