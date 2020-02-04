pragma solidity 0.5.2;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/access/Roles.sol";
import "./compound/ICErc20.sol";

contract CompoundManager {
  using SafeMath for uint256;
  using Roles for Roles.Role;

  /**
   * Emitted when an admin has been added to the Pool.
   * @param admin The admin that was added
   */
  event AdminAdded(address indexed admin);

  /**
   * Emitted when an admin has been removed from the Pool.
   * @param admin The admin that was removed
   */
  event AdminRemoved(address indexed admin);

  /**
   * Emitted on deposit into Compound.
   * @param amount The size of the deposit
   */
  event Deposited(uint256 amount);

  /**
   * Emitted on withdraw from Compound.
   * @param amount The amount of the withdrew
   */
  event Withdrawn(uint256 amount);

  /**
   * A structure containing the administrators
   */
  Roles.Role internal admins;

  /**
   * DAIPoints token
   */
  IERC20 public dpToken;

  /**
   * Compound token
   */
  ICErc20 public cToken;

  function init (
    address _owner,
    address _dpToken,
    address _cToken
  ) public {
    require(_owner != address(0), "CompoundManager/owner-zero");
    require(_dpToken != address(0), "CompoundManager/daip-zero");
    require(_cToken != address(0), "CompoundManager/compound-zero");
    dpToken = IERC20(_dpToken);
    cToken = ICErc20(_cToken);
    _addAdmin(_owner);
  }

  function deposit(uint256 _amount) public onlyAdmin {
    // Deposit into Compound
    require(token().approve(address(cToken), _amount), "CompoundManager/approve");
    require(cToken.mint(_amount) == 0, "CompoundManager/supply");

    emit Deposited(_amount);
  }

  function withdraw(uint256 _amount) public onlyAdmin {
    // Withdraw from Compound and transfer
    require(cToken.redeemUnderlying(_amount) == 0, "CompoundManager/redeem");
    require(token().transfer(address(this), _amount), "CompoundManager/transfer");

    emit Withdrawn(_amount);
  }

  function reward() external view returns(uint256) {
    (uint256 error, uint256 cTokenBalance, uint256 borrowBalance, uint256 exchangeRateMantissa) = cToken.getAccountSnapshot(address(this));
    require(error == 0, "CompoundManager/getAccountSnapshot");
    uint256 cTokenValue = cTokenBalance.mul(exchangeRateMantissa).div(1e18);

    uint256 dpTotalSupply = dpToken.totalSupply();
    uint256 daiReserve = token().balanceOf(address(dpToken));

    return (cTokenValue.sub(dpTotalSupply.div(100).sub(daiReserve))).mul(100);
  }

  /**
   * @notice Returns the token underlying the cToken.
   * @return An ERC20 token address
   */
  function token() public view returns (IERC20) {
    return IERC20(cToken.underlying());
  }

  /**
   * @notice Adds an administrator.
   * Can only be called by administrators.
   * Fires the AdminAdded event.
   * @param _admin The address of the admin to add
   */
  function addAdmin(address _admin) public onlyAdmin {
    _addAdmin(_admin);
  }

  /**
   * @notice Checks whether a given address is an administrator.
   * @param _admin The address to check
   * @return True if the address is an admin, false otherwise.
   */
  function isAdmin(address _admin) public view returns (bool) {
    return admins.has(_admin);
  }

  /**
   * @notice Checks whether a given address is an administrator.
   * @param _admin The address to check
   * @return True if the address is an admin, false otherwise.
   */
  function _addAdmin(address _admin) internal {
    admins.add(_admin);

    emit AdminAdded(_admin);
  }

  /**
   * @notice Removes an administrator
   * Can only be called by an admin.
   * Admins cannot remove themselves. This ensures there is always one admin.
   * @param _admin The address of the admin to remove
   */
  function removeAdmin(address _admin) public onlyAdmin {
    require(admins.has(_admin), "Pool/no-admin");
    require(_admin != msg.sender, "Pool/remove-self");
    admins.remove(_admin);

    emit AdminRemoved(_admin);
  }

  /**
   * @notice requires the caller to be an admin
   */
  modifier onlyAdmin() {
    require(admins.has(msg.sender), "Pool/admin");
    _;
  }
}
