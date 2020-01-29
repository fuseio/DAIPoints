pragma solidity 0.5.2;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/utils/Address.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

/**
* @title DAIPoints token contract
* @author LiorRabin
*/
contract DAIPointsToken is ERC20, ERC20Detailed, Ownable {
  using SafeMath for uint256;

  uint256 public DAI_TO_DAIPOINTS_CONVERSION_RATE = 100;
  IERC20 public DAI;

  constructor () public
    ERC20Detailed('DAIPoints', 'DPTS', 18) {}

  /**
  * @dev Function to be called by owner only to set the DAI token address
  * @param _address DAI token address
  */
  function setDAI(address _address) public onlyOwner {
    require(_address != address(0) && Address.isContract(_address));
    DAI = IERC20(_address);
  }

  /**
  * @dev Function to be called by owner only to set the DAI to DAIPoints conversion rate
  * @param _rate amount of DAIPoints equal to 1 DAI
  */
  function setConversionRate(uint256 _rate) public onlyOwner {
    require(_rate > 0);
    DAI_TO_DAIPOINTS_CONVERSION_RATE = _rate;
  }

  /**
  * @dev Get DAIPoints (minted) in exchange for DAI, according to the conversion rate
  * @param _amount amount (in wei) of DAI to be transferred from msg.sender balance to this contract's balance
  */
  function getDAIPoints(uint256 _amount) public {
    // transfer DAI into this contract
    require(DAI.transferFrom(msg.sender, address(this), _amount), "DAI transfer failed");

    // mint DAIPoints to msg.sender
    _mint(msg.sender, _amount.mul(DAI_TO_DAIPOINTS_CONVERSION_RATE));
  }

  /**
  * @dev Get DAI in exchange for DAIPoints (burned), according to the conversion rate
  * @param _amount amount (in wei) of DAIPoints to be deducted from msg.sender balance
  */
  function getDAI(uint256 _amount) public {
    // burn DAIPoints
    _burn(msg.sender, _amount);

    // transfer DAI to msg.sender
    require(DAI.transferFrom(address(this), msg.sender, _amount.div(DAI_TO_DAIPOINTS_CONVERSION_RATE)), "DAI transfer failed");
  }
}