/**
Copyright 2019 PoolTogether LLC

This file is part of PoolTogether.

PoolTogether is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation under version 3 of the License.

PoolTogether is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with PoolTogether.  If not, see <https://www.gnu.org/licenses/>.
*/

pragma solidity 0.5.2;

import "../../contracts/compound/ICErc20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

contract CErc20Mock is ICErc20 {
  mapping(address => uint256) balances;
  uint256 exchangeRateMantissa;

  function initialize (address _token, uint256 _exchangeRateMantissa) public {
    require(_token != address(0), "token is not defined");
    underlying = _token;
    exchangeRateMantissa = _exchangeRateMantissa;
  }

  function mint(uint256 amount) external returns (uint256) {
    balances[msg.sender] = balances[msg.sender] + amount;
    require(IERC20(underlying).transferFrom(msg.sender, address(this), amount), "could not transfer tokens");
    return 0;
  }

  function balanceOfUnderlying(address account) external view returns (uint256) {
    return balances[account];
  }

  function redeemUnderlying(uint256 requestedAmount) external returns (uint256) {
    require(requestedAmount <= balances[msg.sender], "insufficient underlying funds");
    balances[msg.sender] = balances[msg.sender] - requestedAmount;
    require(IERC20(underlying).transfer(msg.sender, requestedAmount), "could not transfer tokens");
  }

  function getAccountSnapshot(address account) external view returns (uint, uint, uint, uint) {
    return (0, balances[account], 0, exchangeRateMantissa);
  }
}
