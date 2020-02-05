pragma solidity 0.5.2;

/**
* @title Bridge mock contract
* @author LiorRabin
*/
contract BridgeMock {
  address public token;

  function initialize(address _token) public {
    require(_token != address(0), "token is not defined");
    token = _token;
  }

  function onTokenTransfer(address /*_from*/, uint256 /*_value*/, bytes calldata /*_data*/) external view returns(bool) {
    require(msg.sender == token);
    return true;
  }
}