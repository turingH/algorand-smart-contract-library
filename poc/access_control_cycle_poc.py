class AccessControlSimple:
    DEFAULT_ADMIN_ROLE = b"\x00" * 16

    def __init__(self):
        self.roles = {}
        self.address_roles = {}

    def has_role(self, role, account):
        return self.address_roles.get((role, account), False)

    def get_role_admin(self, role):
        return self.roles.get(role, self.DEFAULT_ADMIN_ROLE)

    def _set_role_admin(self, role, admin_role):
        self.roles[role] = admin_role

    def _grant_role(self, role, account):
        if role not in self.roles:
            self.roles[role] = self.DEFAULT_ADMIN_ROLE
        self.address_roles[(role, account)] = True

    def grant_role(self, role, account, sender):
        admin_role = self.get_role_admin(role)
        if not self.has_role(admin_role, sender):
            raise Exception("Access control unauthorised account")
        self._grant_role(role, account)


if __name__ == "__main__":
    ac = AccessControlSimple()
    ROLE_A = b"A" * 16
    ROLE_B = b"B" * 16

    ac._set_role_admin(ROLE_A, ROLE_B)
    ac._set_role_admin(ROLE_B, ROLE_A)

    try:
        ac.grant_role(ROLE_A, "user", sender="creator")
    except Exception as e:
        print("Expected failure:", e)
