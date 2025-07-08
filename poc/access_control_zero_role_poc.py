class AccessControlSimple:
    DEFAULT_ADMIN_ROLE = b"\x00" * 16

    def __init__(self):
        self.roles = {}
        self.address_roles = {}

    def has_role(self, role, account):
        return self.address_roles.get((role, account), False)

    def get_role_admin(self, role):
        return self.roles.get(role, self.DEFAULT_ADMIN_ROLE)

    def _grant_role(self, role, account):
        if role not in self.roles:
            self.roles[role] = self.DEFAULT_ADMIN_ROLE
        if not self.has_role(role, account):
            self.address_roles[(role, account)] = True

    def grant_role(self, role, account, sender):
        admin_role = self.get_role_admin(role)
        if not self.has_role(admin_role, sender):
            raise Exception("Access control unauthorised account")
        self._grant_role(role, account)

if __name__ == "__main__":
    ac = AccessControlSimple()
    ROLE_ZERO = b"\x00" * 16
    user = "user"
    try:
        ac.grant_role(ROLE_ZERO, user, sender=user)
    except Exception as e:
        print("grant failed as expected:", e)
    ac.address_roles[(ROLE_ZERO, "admin")] = True
    try:
        ac.grant_role(ROLE_ZERO, user, sender="admin")
        print("admin granted zero role")
    except Exception as e:
        print("unexpected failure:", e)
    print("user has zero role:", ac.has_role(ROLE_ZERO, user))
