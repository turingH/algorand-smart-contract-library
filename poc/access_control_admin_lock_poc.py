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

    def _revoke_role(self, role, account):
        if self.has_role(role, account):
            del self.address_roles[(role, account)]

    def revoke_role(self, role, account, sender):
        admin_role = self.get_role_admin(role)
        if not self.has_role(admin_role, sender):
            raise Exception("Access control unauthorised account")
        self._revoke_role(role, account)

    def renounce_role(self, role, sender):
        self._revoke_role(role, sender)

if __name__ == "__main__":
    ac = AccessControlSimple()
    admin = "admin"
    # Grant default admin role to admin
    ac._grant_role(ac.DEFAULT_ADMIN_ROLE, admin)
    print("initial admin has role:", ac.has_role(ac.DEFAULT_ADMIN_ROLE, admin))
    # Admin renounces role
    ac.renounce_role(ac.DEFAULT_ADMIN_ROLE, admin)
    print("after renounce has role:", ac.has_role(ac.DEFAULT_ADMIN_ROLE, admin))
    # Attempt to grant role again should fail
    try:
        ac.grant_role(ac.DEFAULT_ADMIN_ROLE, admin, sender=admin)
    except Exception as e:
        print("grant after renounce failed as expected:", e)
