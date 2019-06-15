# LockedToken

Token which slowly unlocks the balance.

Token is initialised with a total supply, treasury address, initial unlocked amount and monthly unlocked amount.

Total supply is transferred immediately to the treasury address with the initial unlocked amount being available to transfer immediately.

Thereafter, every 30 days an additional monthly unlocked amount is available to transfer.

If the monthly unlocked amount is modified during a 30 day period, the modified amount will be unlocked at the end of that 30 day period.

If amounts are transferred to the treasury account, then these are added to the amount available for transfer.
