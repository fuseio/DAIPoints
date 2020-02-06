pragma solidity 0.5.2;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

/**
* @title Bridge mock contract
* @author LiorRabin
*/
contract BridgeMock {
  address public token;

  address public from;
  uint256 public value;
  bytes public data;

  function initialize(address _token) public {
    require(_token != address(0), "token is not defined");
    token = _token;
  }

  function onTokenTransfer(address _from, uint256 _value, bytes calldata _data) external returns(bool) {
    require(msg.sender == token);
    from = _from;
    value = _value;
    data = _data;
    return true;
  }

  function onExecuteMessage(address _recipient, uint256 _amount) external returns(bool) {
    return IERC20(token).transfer(_recipient, _amount);
  }
}