pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";

contract LockedToken is ERC20Detailed, ERC20, Ownable {
    using SafeMath for uint256;

    address private _treasury; // address at which treasury (locked) funds are held
    uint256 private _monthlyUnlocked; // amount which is unlocked each _calcPeriod (30 days)
    uint256 private _unlocked; // amount which was unlocked as of _calcTime
    uint256 private _calcTime; // last time that _unlocked was updated with monthly unlocked amounts
    uint256 private _treasuryTransfered; // total amount transferred out by treasury
    uint256 private _calcPeriod = 30 days; // period for which _monthlyUnlocked is released

    event MonthlyUnlockedChanged(uint256 _oldMonthlyUnlocked, uint256 _newMonthlyUnlocked);
    event TreasuryChanged(address _oldTreasury, address _newTreasury);

    /**
     * @notice constructor
     * @param name of token
     * @param symbol of token
     * @param decimals of token
     * @param totalSupply of token
     * @param treasury of token
     * @param initialUnlocked of token
     * @param monthlyUnlocked of token
     */
    constructor (string memory name, string memory symbol, uint8 decimals, uint256 totalSupply, address treasury, uint256 initialUnlocked, uint256 monthlyUnlocked) public
        ERC20Detailed(name, symbol, decimals)
    {
        require(initialUnlocked <= totalSupply(), "initialUnlocked too large");
        require(monthlyUnlocked <= totalSupply(), "monthlyUnlocked too large");
        _mint(treasury, totalSupply);
        _treasury = treasury;
        _monthlyUnlocked = monthlyUnlocked;
        _unlocked = initialUnlocked;
        _calcTime = now;
    }

    /**
     * @notice returns the treasury account
     * @return address treasury account
     */
    function treasury() external view returns (address) {
        return _treasury;
    }

    /**
     * @notice returns the treasury balance
     * @return uint256 treasury balance
     */
    function treasuryBalance() external view returns (uint256) {
        return balanceOf(_treasury);
    }

    /**
     * @notice returns the amount unlocked each month
     * @return uint256 monthly unlocked amount
     */
    function monthlyUnlocked() external view returns (uint256) {
        return _monthlyUnlocked;
    }

    /**
     * @notice returns the total amount transferred out by the treasury
     * @return uint256 amount transferred out by the treasury
     */
    function treasuryTransfered() external view returns (uint256) {
        return _treasuryTransfered;
    }


    /**
     * @notice returns the amount which is currently unlocked of the treasury balance
     * @return uint256 unlocked amount
     */
    function treasuryUnlocked() external view returns (uint256) {
        (uint256 unlocked, ) = _calcUnlocked();
        if (unlocked < totalSupply()) {
            return unlocked;
        } else {
            return totalSupply();
        }
    }

    function _calcUnlocked() internal view returns (uint256, uint256) {
        uint256 epochs = now.sub(_calcTime).div(_calcPeriod);
        return (_unlocked.add(epochs.mul(_monthlyUnlocked)), _calcTime.add(epochs.mul(_calcPeriod)));
    }

    function _update() internal {
        (uint256 newUnlocked, uint256 newCalcTime) = _calcUnlocked();
        _calcTime = newCalcTime;
        _unlocked = newUnlocked;
    }

    /**
     * @notice allows the treasury address to be modified in case of compromise
     * @param newTreasury new treasury address
     */
    function changeTreasury(address newTreasury) external onlyOwner {
        _transfer(_treasury, newTreasury, balanceOf(_treasury));
        emit TreasuryChanged(_treasury, newTreasury);
        _treasury = newTreasury;
    }

    /**
     * @notice allows the monthly unlocked amount to be modified
     * @param newMonthlyUnlocked new monthly unlocked amount
     */
    function changeMonthlyUnlocked(uint256 newMonthlyUnlocked) external onlyOwner {
        require(newMonthlyUnlocked <= totalSupply(), "monthlyUnlocked too large");
        _update();
        emit MonthlyUnlockedChanged(_monthlyUnlocked, newMonthlyUnlocked);
        _monthlyUnlocked = newMonthlyUnlocked;
    }

    /**
     * @dev See `IERC20.transfer`.
     */
    function transfer(address recipient, uint256 amount) public returns (bool) {
        if (msg.sender == _treasury) {
            _update();
            // Not strictly needed as below .sub will revert if not true, but provides a better error message
            require(amount <= _unlocked, "Insufficient unlocked balance");
            _treasuryTransfered = _treasuryTransfered.add(amount);
            _unlocked = _unlocked.sub(amount);
        }
        bool result = super.transfer(recipient, amount);
        if (recipient == _treasury) {
            _unlocked = _unlocked.add(amount);
        }
        return result;
    }

    /**
     * @dev See `IERC20.transferFrom`.
     */
    function transferFrom(address sender, address recipient, uint256 amount) public returns (bool) {
        if (sender == _treasury) {
            _update();
            // Not strictly needed as below .sub will revert if not true, but provides a better error message
            require(amount <= _unlocked, "Insufficient unlocked balance");
            _treasuryTransfered = _treasuryTransfered.add(amount);
            _unlocked = _unlocked.sub(amount);
        }
        bool result = super.transferFrom(sender, recipient, amount);
        if (recipient == _treasury) {
            _unlocked = _unlocked.add(amount);
        }
        return result;
    }

}
