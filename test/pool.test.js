const {toBN, toWei, soliditySha3} = web3.utils
const { ERROR_MSG, RANDOM_ADDRESS, ZERO_ADDRESS, SECRET, SALT } = require('./helpers')
const SECRET_HASH = soliditySha3(SECRET, SALT)

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
  let lockDuration = 120
  let cooldownDuration = 120

  const _nextDraw = async (options) => {
    const currentDrawId = await pool.currentCommittedDrawId()

    if (currentDrawId.toString() === '0') {
      return await _openNextDraw()
    } else {
      let balance = await daip.balanceOf
      await daip.mint(pool.address, balance.mul(120).div(100), {from: owner})
      return await _rewardAndOpenNextDraw(options)
    }
  }

  const _openNextDraw = async () => {
    let logs = (await pool.openNextDraw(SECRET_HASH)).logs

    const Committed = logs.find(log => log.event === 'Committed')
    const Opened = logs.find(log => log.event === 'Opened')

    return { Committed, Opened }
  }

  const _rewardAndOpenNextDraw = async (options) => {
    let logs
    await pool.lockTokens()
    if (options) {
      logs = (await pool.rewardAndOpenNextDraw(SECRET_HASH, SECRET, SALT, options)).logs;
    } else {
      logs = (await pool.rewardAndOpenNextDraw(SECRET_HASH, SECRET, SALT)).logs;
    }

    const [Rewarded, FeeCollected, Committed, Opened] = logs

    'Opened'.should.be.equal(Opened.event)
    'Rewarded'.should.be.equal(Rewarded.event)
    'Committed'.should.be.equal(Committed.event)

    return { Rewarded, Committed }
  }

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

    let amount = toWei('1', 'ether')
    await dai.mint(alice, amount)
    await dai.approve(daip.address, amount, {from: alice})
    await daip.getDAIPoints(amount, {from: alice})
  })

  describe('init', () => {
    it('should fail if no owner', async () => {
      await pool.init(ZERO_ADDRESS, daip.address, 0, pool.address, lockDuration, cooldownDuration).should.be.rejectedWith(ERROR_MSG)
    })

    it('should fail if no dai points token', async () => {
      await pool.init(admin, ZERO_ADDRESS, 0, pool.address, lockDuration, cooldownDuration).should.be.rejectedWith(ERROR_MSG)
    })

    it('should fail if no fee beneficiary', async () => {
      await pool.init(admin, daip.address, 0, ZERO_ADDRESS, lockDuration, cooldownDuration).should.be.rejectedWith(ERROR_MSG)
    })

    it('should fail if lock or cooldown duration is zero', async () => {
      await pool.init(admin, daip.address, 0, pool.address, 0, cooldownDuration).should.be.rejectedWith(ERROR_MSG)
      await pool.init(admin, daip.address, 0, pool.address, lockDuration, 0).should.be.rejectedWith(ERROR_MSG)
    })

    it('should be successful', async () => {
      await pool.init(admin, daip.address, 0, pool.address, lockDuration, cooldownDuration).should.be.fulfilled

      true.should.be.equal(await pool.isAdmin(admin))
      daip.address.should.be.equal(await pool.token())
      toBN(0).should.be.bignumber.equal(await pool.nextFeeFraction())
      pool.address.should.be.equal(await pool.nextFeeBeneficiary())
      toBN(120).should.be.bignumber.equal(await pool.lockDuration())
      toBN(120).should.be.bignumber.equal(await pool.cooldownDuration())
    })
  })

  describe('addAdmin', () => {
    beforeEach(async () => {
      await pool.init(admin, daip.address, 0, pool.address, lockDuration, cooldownDuration).should.be.fulfilled
    })

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
      await pool.init(admin, daip.address, 0, pool.address, lockDuration, cooldownDuration).should.be.fulfilled
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

  describe('openBalanceOf', () => {
    beforeEach(async () => {
      await pool.init(admin, daip.address, 0, pool.address, lockDuration, cooldownDuration).should.be.fulfilled
    })

    it('should return the users balance for the current draw', async () => {
      let amount = toWei('1', 'ether') // DAIPoints

      await _openNextDraw()

      await daip.approve(pool.address, amount, {from: alice})
      await pool.depositPool(amount, { from: alice }).should.be.fulfilled

      amount.should.be.bignumber.equal(await pool.openBalanceOf(alice))

      await _nextDraw()

      toBN(0).should.be.bignumber.equal(await pool.openBalanceOf(alice))
    })
  })

  describe('committedBalanceOf', () => {
    beforeEach(async () => {
      await pool.init(admin, daip.address, 0, pool.address, lockDuration, cooldownDuration).should.be.fulfilled
    })

    it('should return the users balance for the current draw', async () => {
      let amount = toWei('1', 'ether') // DAIPoints

      await _openNextDraw()

      await daip.approve(pool.address, amount, {from: alice})
      await pool.depositPool(amount, { from: alice }).should.be.fulfilled

      toBN(0).should.be.bignumber.equal(await pool.committedBalanceOf(alice))

      await _nextDraw()

      amount.should.be.bignumber.equal(await pool.committedBalanceOf(alice))
    })
  })

  describe('getDraw', () => {
    it('should return empty values if no draw exists', async () => {
      const draw = await pool.getDraw(1)
      toBN(0).should.be.bignumber.equal(draw.feeFraction)
      ZERO_ADDRESS.should.be.equal(draw.feeBeneficiary)
      toBN(0).should.be.bignumber.equal(draw.openedBlock)
      '0x0000000000000000000000000000000000000000000000000000000000000000'.should.be.equal(draw.secretHash)
    })

    it('should return true values if a draw exists', async () => {
      let feeFraction = toWei('0.1', 'ether')
      await pool.init(admin, daip.address, feeFraction, alice, lockDuration, cooldownDuration).should.be.fulfilled
      await _nextDraw()
      const draw = await pool.getDraw(1)
      feeFraction.should.be.bignumber.equal(draw.feeFraction)
      alice.should.be.equal(draw.feeBeneficiary)
      toBN(0).should.not.be.bignumber.equal(draw.openedBlock)
      SECRET_HASH.should.be.equal(draw.secretHash)
    })
  })

  describe('openNextDraw', () => {
    beforeEach(async () => {
      await pool.init(admin, daip.address, 0, pool.address, lockDuration, cooldownDuration).should.be.fulfilled
      await _nextDraw()
    })

    it('should have opened a draw', async () => {
      toBN(1).should.be.bignumber.equal(await pool.currentOpenDrawId())
      const events = await pool.getPastEvents()
      events.length.should.be.equal(1)
      'Opened'.should.be.equal(events[0].event)
      toBN(1).should.be.bignumber.equal(events[0].args.drawId)
    })

    it('should emit a committed event', async () => {
      const { logs } = await pool.openNextDraw(SECRET_HASH) // now has a committed draw

      const [Committed, Opened] = logs
      'Committed'.should.be.equal(Committed.event)
      toBN(1).should.be.bignumber.equal(Committed.args.drawId)
      'Opened'.should.be.equal(Opened.event)
      toBN(2).should.be.bignumber.equal(Opened.args.drawId)
    })

    it('should revert when the committed draw has not been rewarded', async () => {
      await pool.openNextDraw(SECRET_HASH)
      await pool.openNextDraw(SECRET_HASH).should.be.rejectedWith(`${ERROR_MSG} Pool/not-reward`)
    })

    it('should succeed when the committed draw has been rewarded', async () => {
      await pool.openNextDraw(SECRET_HASH) // now has a committed draw 2
      await pool.lockTokens()
      await pool.reward(SECRET, SALT) // committed draw 2 is now rewarded
      const { logs } = await pool.openNextDraw(SECRET_HASH) // now can open the next draw 3

      const [Committed, Opened] = logs
      'Committed'.should.be.equal(Committed.event)
      toBN(2).should.be.bignumber.equal(Committed.args.drawId)
      'Opened'.should.be.equal(Opened.event)
      toBN(3).should.be.bignumber.equal(Opened.args.drawId)
    })
  })

  describe('reward', () => {
    beforeEach(async () => {
      await pool.init(admin, daip.address, 0, pool.address, lockDuration, cooldownDuration).should.be.fulfilled
    })

    // TODO
  })

  describe('rolloverAndOpenNextDraw', () => {
    beforeEach(async () => {
      await pool.init(admin, daip.address, 0, pool.address, lockDuration, cooldownDuration).should.be.fulfilled
    })

    // TODO
  })

  describe('rollover', () => {
    beforeEach(async () => {
      await pool.init(admin, daip.address, 0, pool.address, lockDuration, cooldownDuration).should.be.fulfilled
    })

    // TODO
  })

  describe('lockTokens', () => {
    beforeEach(async () => {
      await pool.init(admin, daip.address, 0, pool.address, lockDuration, cooldownDuration).should.be.fulfilled
    })

    // TODO
  })

  describe('lockDuration', () => {
    beforeEach(async () => {
      await pool.init(admin, daip.address, 0, pool.address, lockDuration, cooldownDuration).should.be.fulfilled
    })

    // TODO
  })

  describe('lockEndAt', () => {
    beforeEach(async () => {
      await pool.init(admin, daip.address, 0, pool.address, lockDuration, cooldownDuration).should.be.fulfilled
    })

    // TODO
  })

  describe('cooldownDuration', () => {
    beforeEach(async () => {
      await pool.init(admin, daip.address, 0, pool.address, lockDuration, cooldownDuration).should.be.fulfilled
    })

    // TODO
  })

  describe('cooldownEndAt', () => {
    beforeEach(async () => {
      await pool.init(admin, daip.address, 0, pool.address, lockDuration, cooldownDuration).should.be.fulfilled
    })

    // TODO
  })

  describe('unlockTokens', () => {
    beforeEach(async () => {
      await pool.init(admin, daip.address, 0, pool.address, lockDuration, cooldownDuration).should.be.fulfilled
    })

    // TODO
  })

  describe('rewardAndOpenNextDraw', () => {
    beforeEach(async () => {
      await pool.init(admin, daip.address, 0, pool.address, lockDuration, cooldownDuration).should.be.fulfilled
    })

    // TODO
  })

  describe('depositPool', () => {
    beforeEach(async () => {
      await pool.init(admin, daip.address, 0, pool.address, lockDuration, cooldownDuration).should.be.fulfilled
    })

    // TODO
  })

  describe('depositSponsorship', () => {
    beforeEach(async () => {
      await pool.init(admin, daip.address, 0, pool.address, lockDuration, cooldownDuration).should.be.fulfilled
    })

    // TODO
  })

  describe('withdrawSponsorshipAndFee', () => {
    beforeEach(async () => {
      await pool.init(admin, daip.address, 0, pool.address, lockDuration, cooldownDuration).should.be.fulfilled
    })

    // TODO
  })

  describe('withdrawOpenDeposit', () => {
    beforeEach(async () => {
      await pool.init(admin, daip.address, 0, pool.address, lockDuration, cooldownDuration).should.be.fulfilled
    })

    // TODO
  })

  describe('withdrawCommittedDeposit', () => {
    beforeEach(async () => {
      await pool.init(admin, daip.address, 0, pool.address, lockDuration, cooldownDuration).should.be.fulfilled
    })

    // TODO
  })

  describe('withdraw', () => {
    beforeEach(async () => {
      await pool.init(admin, daip.address, 0, pool.address, lockDuration, cooldownDuration).should.be.fulfilled
    })

    // TODO
  })

  describe('totalBalanceOf', () => {
    beforeEach(async () => {
      await pool.init(admin, daip.address, 0, pool.address, lockDuration, cooldownDuration).should.be.fulfilled
    })

    // TODO
  })

  describe('fee fraction is greater than zero', () => {
    beforeEach(async () => {
      await pool.init(admin, daip.address, 0, pool.address, lockDuration, cooldownDuration).should.be.fulfilled
    })

    // TODO
  })

  describe('pool is rewarded without a winner', () => {
    beforeEach(async () => {
      await pool.init(admin, daip.address, 0, pool.address, lockDuration, cooldownDuration).should.be.fulfilled
    })

    // TODO
  })

  describe('setNextFeeFraction', () => {
    beforeEach(async () => {
      await pool.init(admin, daip.address, 0, pool.address, lockDuration, cooldownDuration).should.be.fulfilled
    })

    // TODO
  })

  describe('setNextFeeBeneficiary', () => {
    beforeEach(async () => {
      await pool.init(admin, daip.address, 0, pool.address, lockDuration, cooldownDuration).should.be.fulfilled
    })

    // TODO
  })

  describe('pauseDeposits', () => {
    beforeEach(async () => {
      await pool.init(admin, daip.address, 0, pool.address, lockDuration, cooldownDuration).should.be.fulfilled
    })

    // TODO
  })

  describe('unpauseDeposits', () => {
    beforeEach(async () => {
      await pool.init(admin, daip.address, 0, pool.address, lockDuration, cooldownDuration).should.be.fulfilled
    })

    // TODO
  })

  describe('transferBalanceToSponsorship', () => {
    beforeEach(async () => {
      await pool.init(admin, daip.address, 0, pool.address, lockDuration, cooldownDuration).should.be.fulfilled
    })

    // TODO
  })
})