pragma solidity 0.5.2;

import "./ERC677.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Burnable.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/utils/Address.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./compound/ICErc20.sol";

/**
* @title DAIPoints token contract
* @author LiorRabin
*/
contract DAIPointsToken is ERC677, ERC20Detailed, ERC20Mintable, ERC20Burnable, Ownable {
  using SafeMath for uint256;

  uint256 public constant DECIMALS = 10 ** 18;

  IERC20 public dai;
  ICErc20 public compound;
  uint256 public daiToDaipConversionRate = 100;
  address public bridge;
  uint256 public fee;

  constructor (address _dai, address _compound) public
    ERC20Detailed('DAIPoints', 'DAIp', 18) {
      setDAI(_dai);
      setCompound(_compound);
    }

  /**
  * @dev Function to be called by owner only to set the DAI token address
  * @param _address DAI token address
  */
  function setDAI(address _address) public onlyOwner {
    require(_address != address(0) && Address.isContract(_address));
    dai = IERC20(_address);
  }

  /**
  * @dev Function to be called by owner only to set the Compound address
  * @param _address Compound address
  */
  function setCompound(address _address) public onlyOwner {
    require(_address != address(0) && Address.isContract(_address));
    compound = ICErc20(_address);
  }

  /**
  * @dev Function to be called by owner only to set the fee
  * @param _fee Fee amount
  */
  function setFee(uint256 _fee) public onlyOwner {
    require(fee <= DECIMALS);
    fee = _fee;
  }

  /**
  * @dev Function to be called by owner only to set the bridge address
  * @param _address bridge address
  */
  function setBridge(address _address) public onlyOwner {
    require(_address != address(0) && Address.isContract(_address));
    bridge = _address;
  }

  /**
  * @dev Function to be called by owner only to set the DAI to DAIPoints conversion rate
  * @param _rate amount of DAIPoints equal to 1 DAI
  */
  function setConversionRate(uint256 _rate) public onlyOwner {
    require(_rate > 0);
    daiToDaipConversionRate = _rate;
  }

  /**
  * @dev Get DAIPoints (minted) in exchange for DAI, according to the conversion rate
  * @param _amount amount (in wei) of DAI to be transferred from msg.sender balance to this contract's balance
  */
  function getDAIPoints(uint256 _amount) public bridgeExists returns(bool) {
    // Transfer DAI into this contract
    require(dai.transferFrom(msg.sender, address(this), _amount), "DAI/transferFrom");

    // Mint DAIPoints
    uint256 daipAmount = _amount.mul(daiToDaipConversionRate);
    _mint(address(this), daipAmount);

    // Transfer DAIPoints (on other side) to msg.sender using the bridge
    require(ERC677(address(this)).transferAndCall(bridge, daipAmount, abi.encodePacked(msg.sender)), "DAIPoints/transferAndCall");

    // Deposit into Compound
    require(dai.approve(address(compound), _amount), "DAI/approve");
    require(compound.mint(_amount) == 0, "Compound/mint");

    return true;
  }

  /**
  * @dev Override ERC20 transfer function
  * @param _recipient address to receive the _amount exchanged into DAI
  * @param _amount amount (in wei) of DAIPoints to be exchanged into DAI and transferred to _recipient
  */
  function transfer(address _recipient, uint256 _amount) public returns (bool) {
    uint256 daiAmount = _amount.div(daiToDaipConversionRate);

    // Withdraw from Compound and transfer
    require(compound.redeemUnderlying(daiAmount) == 0, "Compound/redeemUnderlying");

    // Burn DAIPoints
    _burn(msg.sender, _amount);

    // Transfer DAI to the recipient
    require(dai.approve(address(this), daiAmount), "DAI/approve");
    require(dai.transferFrom(address(this), _recipient, daiAmount), "DAI/transferFrom");

    return true;
  }

  /**
  * @dev Function to be called by owner only to reward DAIPoints (per DAI interest in Compound)
  * @param _winner address to receive reward
  */
  function reward(address _winner) public onlyOwner bridgeExists {
    // Calculate the gross winnings, fee and reward amount (in DAI)
    uint256 grossWinningsAmount = _grossWinnings();
    uint256 rewardAmount = grossWinningsAmount.mul(DECIMALS.sub(fee)).div(DECIMALS);
    uint256 feeAmount = grossWinningsAmount.sub(rewardAmount);

    // Mint DAIPoints
    uint256 daipRewardAmount = rewardAmount.mul(daiToDaipConversionRate);
    _mint(address(this), daipRewardAmount);

    // Transfer reward (on other side) to the winner using the bridge
    require(ERC677(address(this)).transferAndCall(bridge, daipRewardAmount, abi.encodePacked(_winner)), "DAIPoints/transferAndCall");

    // Transfer fee (in DAI) to the owner
    if (feeAmount > 0) {
      // Withdraw from Compound and transfer
      require(compound.redeemUnderlying(feeAmount) == 0, "Compound/redeemUnderlying");

      // Transfer DAI to the recipient
      require(dai.approve(address(this), feeAmount), "DAI/approve");
      require(dai.transferFrom(address(this), owner(), feeAmount), "DAI/transferFrom");
    }
  }

  function _grossWinnings() private view returns(uint256) {
    (uint256 error, uint256 compoundBalance, uint256 borrowBalance, uint256 exchangeRateMantissa) = compound.getAccountSnapshot(address(this));
    require(error == 0);
    uint256 compoundValue = compoundBalance.mul(exchangeRateMantissa).div(1e18);

    uint256 totalSupply = ERC20(address(this)).totalSupply().div(daiToDaipConversionRate);

    return compoundValue.sub(totalSupply);
  }

  /**
  * @dev This modifier verifies that the change initiated has not been finalized yet
  */
  modifier bridgeExists() {
    require(bridge != address(0));
    _;
  }
}