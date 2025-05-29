from algopy import Global, Txn
from algopy.arc4 import Address, abimethod

from ..Upgradeable import Upgradeable


class MockUpgradeable(Upgradeable):
    def __init__(self) -> None:
        Upgradeable.__init__(self)

    @abimethod
    def initialise(self, admin: Address) -> None: # type: ignore[override]
        assert Txn.sender == Global.creator_address, "Caller must be the contract creator"
        super().initialise(admin)
