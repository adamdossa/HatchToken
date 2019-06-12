pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";

contract LockedToken is ERC20Detailed, ERC20, Ownable {
    using SafeMath for uint256;

    address private _treasury;
    uint256 private _monthlyUnlocked;
    uint256 private _unlocked;
    uint256 private _calcTime;
    uint256 private _treasuryTransfered;
    uint256 private _calcPeriod = 30 days;

    event MonthlyUnlockedChanged(uint256 _oldMonthlyUnlocked, uint256 _newMonthlyUnlocked);
    event TreasuryChanged(address _oldTreasury, address _newTreasury);

    constructor (string memory name, string memory symbol, uint8 decimals, uint256 totalSupply, address treasury, uint256 initialUnlocked, uint256 monthlyUnlocked) public
        ERC20Detailed(name, symbol, decimals)
    {
        _mint(treasury, totalSupply);
        _treasury = treasury;
        _monthlyUnlocked = monthlyUnlocked;
        _unlocked = initialUnlocked;
        _calcTime = now;
    }

    function treasury() public view returns (address) {
        return _treasury;
    }

    function treasuryBalance() public view returns (uint256) {
        return balanceOf(_treasury);
    }

    function monthlyUnlocked() public view returns (uint256) {
        return _monthlyUnlocked;
    }

    function treasuryUnlocked() public view returns (uint256) {
        (uint256 unlocked, ) = _calcUnlocked();
        return unlocked;
    }

    function _calcUnlocked() internal view returns (uint256, uint256) {
        uint256 epochs = now.sub(_calcTime).div(_calcPeriod);
        return (_unlocked.add(epochs.mul(_monthlyUnlocked)), _calcTime.add(epochs.mul(_calcPeriod)));
    }

    function treasuryTransfered() external view returns (uint256) {
        return _treasuryTransfered;
    }

    function changeTreasury(address newTreasury) external onlyOwner {
        _transfer(_treasury, newTreasury, balanceOf(_treasury));
        emit TreasuryChanged(_treasury, newTreasury);
        _treasury = newTreasury;
    }

    function changeMonthlyUnlocked(uint256 newMonthlyUnlocked) external onlyOwner {
        _update();
        emit MonthlyUnlockedChanged(_monthlyUnlocked, newMonthlyUnlocked);
        _monthlyUnlocked = newMonthlyUnlocked;
    }

    function _update() internal {
        (uint256 newUnlocked, uint256 newCalcTime) = _calcUnlocked();
        _calcTime = newCalcTime;
        _unlocked = newUnlocked;
    }

    function transfer(address recipient, uint256 amount) public returns (bool) {
        if (msg.sender == _treasury) {
            _update();
            // Not strictly needed as below .sub will revert if not true, but provides a better error message
            require(amount <= _unlocked, "Insufficient unlocked balance");
            _treasuryTransfered = _treasuryTransfered.add(amount);
            _unlocked = _unlocked.sub(amount);
        }
        return super.transfer(recipient, amount);
    }

    function transferFrom(address sender, address recipient, uint256 amount) public returns (bool) {
        if (sender == _treasury) {
            _update();
            // Not strictly needed as below .sub will revert if not true, but provides a better error message
            require(amount <= _unlocked, "Insufficient unlocked balance");
            _treasuryTransfered = _treasuryTransfered.add(amount);
            _unlocked = _unlocked.sub(amount);
        }
        return super.transferFrom(sender, recipient, amount);
    }

}
